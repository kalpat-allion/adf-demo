const df = require('durable-functions');
const axios = require("axios");

df.app.activity('FetchDataFromApi', {
    handler: async (input) => {

      let apiUrl = input.metaData.url; // Replace with your API URL

      let response = {}

      if(input.metaData.params) {
        const pathArray = input.metaData.params.path


        for(const path of pathArray) {

          const dynamicPath = path.path;
          const actualPath = getValueByPath(input.result, dynamicPath);
          
          apiUrl = apiUrl.replace(path.paramKey, actualPath)
         
        }


        response = await axios.get(apiUrl);
        

        if(input.metaData.responseType && input.metaData.responseType == "array") {
          if(response.data.length == 1) {
            response.data = {...response.data[0]}
          }
        }

        
      } else {
        response = await axios.get(apiUrl);
        
      }
      // console.log("🚀 ~ handler: ~ response:", response.data.users)
      // Return the data fetched from the API

      return response.data;
    },
});


function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
}
