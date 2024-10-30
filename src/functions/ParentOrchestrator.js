const { app } = require('@azure/functions');
const df = require('durable-functions');

require("./activity-functions/fetch-data");

df.app.orchestration("ParentOrchestrator", function* (context) {
  const config = context.df.getInput(); // Get the configuration JSON object
  context.log(`Received configuration: ${JSON.stringify(config)}`);

  let results = [];
  // Loop through each step in the config
  // for (const step of config.config) {
  //     results = yield context.df.callActivity(step.type, { metaData: step.metaData, results })
  // }

  for (const step of config.config) {
    if (step.orchestratorMetaData && step.orchestratorMetaData.isArray) {
      if (results) {
        if (step.orchestratorMetaData.batchSize) {
          const batchSize = step.orchestratorMetaData.batchSize;

          let batchResults = [];

          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);

            const tasks = batch.map((result) =>
              context.df.callActivity(step.name, {
                metaData: step.metaData,
                result,
              })
            );

            const batchResult = yield context.df.Task.all(tasks);

            batchResults = batchResults.concat(batchResult);
          }

            // const final = { results: batchResults }
            // console.log("🚀 ~ df.app.orchestration ~ final:", JSON.stringify(final))

            return { results: batchResults }
        }
      }
    } else {
      results = yield context.df.callActivity(step.name, {
        metaData: step.metaData,
        results,
      });
    //   console.log("🚀 ~ df.app.orchestration ~ results: else", results);
    }
  }
});


app.http('ParentOrchestratorHttpStart', {
    route: 'orchestrators/{orchestratorName}',
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    extraInputs: [df.input.durableClient()],
    handler: async (request, context) => {
       
        // Initialize an array to hold the chunks of data
        // Create a reader from the readable stream
        const reader = request.body.getReader();
        const chunks = [];
        let jsonData;
        try {
            let done = false;

            // Read the stream in chunks
            while (!done) {
                const { value, done: isDone } = await reader.read();
                if (value) {
                    chunks.push(value); // Collect the data chunks
                }
                done = isDone;
            }

            // Concatenate the chunks into a single Uint8Array
            const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0));
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.byteLength;
            }

            // Convert the buffer to string and then parse it as JSON
            const jsonString = new TextDecoder().decode(buffer);
            jsonData = JSON.parse(jsonString);
           

        } catch (error) {
            context.log(`Error reading stream: ${error.message}`);
        }
       
        const client = df.getClient(context);
        const instanceId = await client.startNew(request.params.orchestratorName, { input: jsonData });

        context.log(`Started orchestration with ID = '${instanceId}'.`);

        return client.createCheckStatusResponse(request, instanceId);
    },
});