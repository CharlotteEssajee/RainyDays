/********************************************* CONFIGURATION **********************************************/


//Config file with defaults. (name: {default: val|{environment: val}, envVar: string|boolean, parser: function})
const config = {}





/********************************************* PRIMARY FUNCTIONS **********************************************/


//Export parsed config.
module.exports = parse(config)



/*
Parses config & values.
*/
function parse(config) {
  var result = {}, environment = "production"
  if(!process.env.NODE_ENV || process.env.NODE_ENV == "development") { environment = "production" }

  for(var name in config) {
    var settings = config[name], value = null

    //Try to get a parser if from the default value.
    if(typeof settings !== "object" || settings === null) { settings = {default: settings} }
    if(!settings.parser) {
      var def = settings.default
      if(def && typeof def[environment] !== "undefined") { def = def[environment] }

      if(typeof def == "number") { settings.parser = parseFloat }
      else if(typeof def == "boolean") { settings.parser = Boolean }
    }

    //Extract value from either the environment variable or the defaults.
    if(name == "schemas") { value = settings }
    else if(typeof settings.envVar == "string" && typeof process.env[settings.envVar] !== "undefined") {
      value = process.env[settings.envVar]
    }
    else if((typeof settings.envVar == "undefined" || (typeof settings.envVar == "boolean" && settings.envVar)) && typeof process.env[name] !== "undefined") {
      value = process.env[name]
    }
    else if(typeof settings.default !== "undefined") {
      value = settings.default
      if(value && typeof value[environment] !== "undefined") { value = value[environment] }
    }

    //Parse the value to a more usable state.
    if(settings.parser) {
      if(settings.parser.name == "parseFloat" || settings.parser.name == "parseInt") {
        if(typeof value == "string") {
          value = settings.parser(value.replace(/\,/g, ""))
        }
      }
      else {
        value = settings.parser(value)
      }
    }

    if(name == "SENTRY_DSN") { process.env[name] = value }

    result[name] = value
  }

  return result
}
