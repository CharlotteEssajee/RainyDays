/*
Handles smooth loading.
*/
var app = Aviation({source: 'a[href]:not([target="_blank"]):not([href^="#"])', skipOnLoad: true})
app.use(async (req, res, next) => {
  try {
    var last = window.location.pathname
    if(last.length > 1 && last[last.length - 1] == "/") { last = last.replace(/\/$/, "") }
    if(req.path === last) { return }

    $("body").addClass("loading")
    setTimeout(() => $("html, body").stop().animate({scrollTop: 0}, 0, "linear"), 400)

    var start = new Date()
    var page = (await axios(req.url, {timeout: 20000, method: "GET", withCredentials: true})).data
    var html = $("<div></div>").append($.parseHTML(page))

    var end = 500 - (new Date() - start)
    if(end < 0) { end = 0 }
    setTimeout(() => {
      //Add title.
      res.page(html.find("title").text())

      //Add content.
      $(".page").html(html.find(".page").html())
      $("body").addClass("loading-done")

      setTimeout(() => {
        $("body").removeClass("loading").removeClass("loading-done")
      }, 400)
    }, end)
  }
  catch (e) { console.error(e); next() }
})





/*
Catches 404s
*/
app.use((req, res, next) => {
  try {
    var main =
    <section class="error">
      <div class="container">
        <div class="row">
          <div class="col-md-12 text-center">
            <h1 class="display-1">Oops!</h1>
            <h4 class="mt-4">Page not found. Please go back.</h4>
          </div>
        </div>
      </div>
    </section>

    res.page("Page not found | RainyDays ").html(main)
  } catch(e) { console.error(e); next(e) }
})