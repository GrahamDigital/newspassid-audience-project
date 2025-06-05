window.googletag = window.googletag || { cmd: [] };

// get newspassid cookie
let newspassid = document.cookie
  .split("; ")
  .find((row) => row.startsWith("newspassid="))
  ?.split("=")[1];
console.log("[newspassid] cookie", newspassid);

if (!newspassid) {
  // Look in localStorage
  newspassid = localStorage.getItem("newspassid") ?? undefined;
  console.log("[newspassid] localStorage", newspassid);
}

// get newspass_segments cookie
let newspass_segments = document.cookie
  .split("; ")
  .find((row) => row.startsWith("npid_segments="))
  ?.split("=")[1];
console.log("[newspass_segments] cookie", newspass_segments);

// get npid_segments from localStorage
if (!newspass_segments) {
  newspass_segments = localStorage.getItem("npid_segments") ?? undefined;
  console.log("[npid_segments] localStorage", newspass_segments);
}

googletag.cmd.push(function () {
  // Define ad slots
  googletag
    .defineSlot(
      "/6355419/Travel/Europe/France/Paris",
      [300, 250],
      "div-gpt-ad-1682372512510-0",
    )
    ?.addService(googletag.pubads());

  // set ppid
  if (newspassid) {
    googletag.pubads().setPublisherProvidedId(newspassid);
  }

  // set segments
  if (newspass_segments) {
    googletag
      .pubads()
      .setTargeting("npid_segments", decodeURIComponent(newspass_segments));
  }

  // Enable services
  googletag.pubads().enableSingleRequest();
  googletag.enableServices();

  googletag.cmd.push(function () {
    googletag.display("div-gpt-ad-1682372512510-0");
  });
});
