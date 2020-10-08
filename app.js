/********************************************* SETUP FUNCTIONS **********************************************/


//Load config.
const config = require("./config.js")


//Load required packages.
require("./helpers.js")
const Render = require("./render.js")

//Create an app server.
const app = newApp({
  type: "api",
  cookies: true,
  body: true
})


//Render all website content.
const pages = Render(__dirname + "/pages", {skip: ["templates"]})




/********************************************* WEBSITE SERVING FUNCTIONS **********************************************/


/*
Serves the website.
*/
app.use(async (req, res, next) => {
  try {
    var path = req.path

    //Get page.
    var page = pages[path]
    if(!page || !["GET", "OPTIONS", "HEAD"].includes(req.method)) { page = pages["/404"] }

    //Get variables.
    var vars = {req, config}

    //Render & return.
    var cache = 0
    if(environment == "production" && path.includes("/assets")) { cache = 3600 }
    res.status(page.statusCode || 200).set({"Content-Type": page.type, "Cache-Control": "max-age=" + cache}).send(await page.load(vars))
  }
  catch (e) { next(e) }
})





/********************************************* REQUEST ERROR FUNCTIONS **********************************************/


/*
Handles 500s.
*/
app.errorHandler(async (err, req, res, next) => {
  try {
    console.error(err)
    return res.status(500).send("500 - An internal server error occured")
  }
  catch (e) { console.error(e); next(e) }
})