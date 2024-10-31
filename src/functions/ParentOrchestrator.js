const { app } = require('@azure/functions');
const df = require('durable-functions');


require("./APIOrchestrator"); //sub orchestrator

df.app.orchestration("ParentOrchestrator", function* (context) {
  const config = context.df.getInput(); // Get the configuration JSON object
  context.log(`Received configuration: ${JSON.stringify(config)}`);

  let results = {};

  for (const step of config.executionSteps) {
    if(step.type == "connector") {
      if(step.connectorType == "API") {

        const subOrchParam = {
          results,
          step
        }

        // call APIOrchestrator sub orchestrator
        results = yield context.df.callSubOrchestrator(
          "APIOrchestrator",
          subOrchParam
        );

      }
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