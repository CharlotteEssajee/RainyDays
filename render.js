/********************************************* SETUP FUNCTIONS **********************************************/


//Load required packages.
const fs = require("fs-extra")
const glob = require("glob")
const pathLib = require("path")
const mime = require("mime")

const ejs = require("ejs")
const handlebars = require("handlebars")
const babel = require("@babel/core")
const sass = require("sass")

const postCSS = require("postcss")([require("lost"), require("postcss-combine-duplicated-selectors"), require("postcss-calc"), require("autoprefixer"), require("cssnano")({preset: ["default", {cssDeclarationSorter: true}]})])
const htmlMinifier = require("html-minifier").minify
const terser = require("terser")
const imagemin = require("imagemin")
const imageminPlugins = {
  "image/png": require("imagemin-pngquant")({strip: true, speed: 5}),
  "image/jpeg": require("imagemin-mozjpeg")({quality: 75, progressive: true}),
  "image/webp": require("imagemin-webp")({quality: 75, lossless: true}),
  "image/svg+xml": require("imagemin-svgo")(),
  "image/gif": require("imagemin-gifsicle")({optimizationLevel: 3})
}


const io = require("socket.io")
const nodeWatch = require("node-watch")
const chalk = require("chalk")


//Export primary function.
module.exports = renderDirectory
module.exports.directory = renderDirectory
module.exports.file = RenderAsset
module.exports.render = RenderAsset
module.exports.watch = watch
module.exports.convert = convert
module.exports.minify = minify





/********************************************* PRIMARY FUNCTIONS **********************************************/


/*
Convert directory to render assets object.
*/
function renderDirectory(directory, options = {}) {
  //List all files from root directory.
  var root = pathLib.resolve(directory), files = glob.sync(pathLib.join(root, "/**/*"), {dot: true}), assets = {}

  //Convert skip option to array.
  if(options.skip && options.skip.constructor.name !== "Array") { options.skip = [options.skip] }
  if(typeof options.watch == "undefined" && typeof environment !== "undefined") { options.watch = environment == "development" }

  //Assign relative path name to each render object & begin rendering.
  for(var file of files) {
    var name = "/" + pathLib.relative(root, file)
    if(fs.lstatSync(file).isDirectory()) { continue }

    //Handle skipping.
    if(options.skip) {
      var skip = false
      for(var i in options.skip) { if(file.startsWith(pathLib.resolve(root, options.skip[i]))) { skip = true; break } }
      if(skip) { continue }
    }

    //Remove extensions if being used for serving (Disable for storing files).
    if(!options.skipChangingExtensions) {
      name = name.replace(/\.html|\.ejs|\.handlebars/g, "").replace(".jsx", ".js").replace(/\.sass|\.scss/g, ".css")
      if(file.includes("/index")) { name = name.replace("/index", (name == "/index" ? "/" : "")) }
    }

    //Create render asset object.
    assets[name] = new RenderAsset(file, options.vars, options.watch)
    assets[name].name = name
  }

  //Add serving & saving functions.
  Object.defineProperties(assets, {
    serve: {
      configurable: true,
      writable: true,
      value: function(options = {}) {
        var cache = 3600
        if(typeof environment !== "undefined" && environment == "development") { cache = 0 }
        if(options.cache) { cache = options.cache }

        return async (req, res, next) => {
          try {
            if(!(options.methods || ["GET", "OPTIONS", "HEAD"]).includes(req.method)) { return next() }
            var asset = assets[options.prefix ? options.prefix + req.path : req.path]
            if(!asset) { return next() }

            res.status(asset.statusCode || options.status || 200).set({"Content-Type": asset.type, "Cache-Control": "max-age=" + String(cache)}).send(await asset.load(req.vars))
          }
          catch (e) { next(e) }
        }
      }
    },
    save: {
      configurable: true,
      writable: true,
      value: async function(to, options = {}) {
        to = pathLib.resolve(to)

        for(var path in assets) {
          var content = assets[path], name = "/" + pathLib.relative(root, content.file)
          name = name.replace(/\.ejs|\.handlebars/g, ".html").replace(".jsx", ".js").replace(/\.sass|\.scss/g, ".css")
          await fs.outputFile(pathLib.join(to, name), await content.load(options.vars))
        }
        return true
      }
    }
  })

  //Add watcher if requested.
  if(options.watch && !options.skipCallingWatch) { watch(root, assets, options) }
  return assets
}



/*
Converts a file path to a render asset.
*/
function RenderAsset(file, defaultVars, addWatchingCode) {
  if(!(this instanceof RenderAsset)) { return new RenderAsset(...arguments) }
  this.status = "fetching_file", this.file = file, this.minified = false

  //Get the accurate file type.
  this.type = mime.getType(file) || "text/plain"
  if(file.includes(".ejs")) { this.type = "text/html" }
  else if(file.includes(".handlebars")) { this.type = "text/html" }
  else if(file.includes(".js")) { this.type = "application/javascript" }
  else if(file.includes(".sass")) { this.type = "text/css" }
  else if(file.includes(".scss")) { this.type = "text/css" }

  //Handle fetching, rendering & minification in an async promise.
  this.promise = new Promise(async (resolve, reject) => {
    try {
      //Fetch file content.
      this.content = await fs.readFile(this.file)
      if(this.file.includes("assets/js/")) { return resolve(this.status = "rendered") }

      //Add change handler to all HTML.
      if(addWatchingCode && this.type == "text/html") {
        this.content = String(this.content) + '<script src="https://cdn.jsdelivr.net/npm/socket.io-client@2.3.0/dist/socket.io.js" integrity="sha256-bQmrZe4yPnQrLTY+1gYylfNMBuGfnT/HKsCGX+9Xuqo=" crossorigin="anonymous"></script>'
        + '<script>io(window.location.protocol + "//" + window.location.hostname + ":7931").on("changed", () => window.location.reload())</script>'
      }

      //Convert file types to usable types.
      if(/\.ejs|\.handlebars|\.js|\.sass|\.scss/.test(this.file)) {
        this.status = "converting"
        this.content = await convert(this.file, this.content)
      }
      this.status = "rendered"

      //Handle any minification separately.
      if(["text/html", "text/css", "application/javascript", "image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"].includes(this.type) && typeof this.content !== "function") {
        this.content = await minify(this.content, this.type)
        this.minified = true
      }

      return resolve()
    }
    catch (e) { reject(e) }
  })

  //Create a loader.
  this.load = async vars => {
    //Make sure asset has been rendered.
    if(this.status !== "rendered") { await new Promise(resolve => setInterval(() => this.status == "rendered" ? resolve() : undefined), 50) }

    //Render template.
    var content = this.content
    if(typeof content == "function") {
      content = await content(Object.assign({}, defaultVars, vars))
      if(this.type == "text/html") { content = await minify(content, "text/html") }
    }

    return content
  }

  return this
}





/********************************************* WATCHING FUNCTIONS **********************************************/


/*
Watches a directory & updates assets.
+ Informs clients via ws.
*/
function watch(directory, assets, options = {}) {
  //Create a socket to listen on.
  var server = io(7931)

  //Create a watcher.
  var watcher = nodeWatch(directory, {recursive: true})
  watcher.on("change", (evt, file) => {
    try {
      //Change all assets to new assets.
      var newAssets = renderDirectory(directory, Object.assign({}, options, {skipCallingWatch: true}))
      for(var name in assets) { delete assets[name] }
      for(var name in newAssets) { assets[name] = newAssets[name] }

      //Notify.
      console.log(chalk.bold.blue("@rainydays/render:"), chalk.yellow("Updated /" + pathLib.relative(directory, file)))
      server.sockets.emit("changed")
    }
    catch (e) { console.error(e) }
  })

  console.log(chalk.bold.blue("@rainydays/render:"), chalk.green("Started watching " + pathLib.basename(directory)))
}





/********************************************* HELPER FUNCTIONS **********************************************/


/*
Converts from a file type to a usable type (JSX -> JS, SASS -> CSS).
*/
async function convert(path, content) {
  if(path.includes(".ejs")) {
    content = ejs.compile(String(content), {async: true, filename: path, root: pathLib.dirname(path)})
  }
  else if(path.includes(".handlebars")) {
    content = handlebars.compile(content)
  }
  else {
    if(path.includes(".js")) {
      content = await babel.transform(String(content), {filename: path, cwd: pathLib.dirname(path),
      presets: [["@babel/preset-react", {pragma: "Aviation.element"}], "@babel/preset-env"],
      plugins: [["transform-async-to-promises", {inlineHelpers: true}], "object-to-json-parse", "closure-elimination"]
      }).code
    }
    else if(path.includes(".sass") || path.includes(".scss")) {
      content = sass.renderSync({data: String(content), includePaths: [pathLib.dirname(path)], indentedSyntax: path.includes(".sass")}).css
    }
  }

  return content
}



/*
Minifies an asset.
*/
async function minify(content, type) {
  var start = new Date()
  if(type == "text/html") {
    content = htmlMinifier(String(content), {collapseWhitespace: true, minifyCSS: true, minifyJS: function(content) { var min = terser.minify(content); if(!min.error) { return min.code } }, removeComments: true, removeRedundantAttributes: true})
  }
  else if(type == "text/css") {
    content = (await postCSS.process(String(content), {from: undefined})).css
  }
  else if(type == "application/javascript") {
    var min = terser.minify(String(content))
    if(!min.error) { content = min.code }
  }
  else if(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"].includes(type)) {
    var min = await imagemin.buffer(content, {plugins: [imageminPlugins[type]]})
    if(min) { content = min }
  }

  return content
}
