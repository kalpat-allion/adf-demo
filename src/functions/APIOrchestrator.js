const df = require("durable-functions");
require("./activity-functions/fetch-data");

df.app.orchestration("APIOrchestrator", function* (context) {
    
   const config = context.df.getInput();
   const step = config.step;
   let results = config.results;

   if (step.metaData.isArray) {
      if (results && Object.keys(results).length > 0) {
         if (step.metaData.batchSize) {
            const batchSize = step.metaData.batchSize;

            let batchResults = [];

            for (let i = 0; i < results.length; i += batchSize) { // batchwise processing
               const batch = results.slice(i, i + batchSize);

               // ---------------fan-out/fan-in-------------
               const tasks = batch.map((result) =>
                  context.df.callActivity('FetchDataFromApi', {
                     metaData: step.metaData,
                     result,
                  })
               );

               const batchResult = yield context.df.Task.all(tasks);
               // ---------------fan-out/fan-in-------------

               batchResults = batchResults.concat(batchResult);
            }

            console.log("🚀 ~ df.app.orchestration ~ batchResults:", batchResults)


            // const final = { results: batchResults }
            // console.log("🚀 ~ df.app.orchestration ~ final:", JSON.stringify(final))

            return { results: batchResults }

         } else { //no batch size
            results = yield context.df.callActivity('FetchDataFromApi', {
               metaData: step.metaData,
               results,
            });

            return results;
         }
      }
   } else { // if 'results' is an empty object


      results = yield context.df.callActivity('FetchDataFromApi', {
         metaData: step.metaData,
         results,
      });

      return results;
      
      //   console.log("🚀 ~ df.app.orchestration ~ results: else", results);
   }

    

    
});