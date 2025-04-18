# NewsPassID SDK

This package contains the NewsPassID SDK for audience management.

## Development

To run the example in development mode:

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Start the dev server
npm run dev
```

This will:

1. Build the NewsPassID library and async loader
2. Start a dev server on port 3000
3. Open the example page in your browser
4. Watch for changes in the source files and rebuild automatically

## Building for Production

To build the library for production:

```bash
npm run build
```

This will generate the following files in the `dist` directory:

- `newspassid.js` - UMD bundle
- `newspassid.esm.js` - ES module bundle
- `newspassid-async.js` - Async loader bundle

## Usage

### Basic Usage

```html
<!-- NewsPassID Async Loader - Place as early as possible in the head -->
<script>
  // Publisher configuration
  var NEWSPASS_CONFIG = {
    namespace: "gmg",
    lambdaEndpoint: "https://npid.gmg.io/newspassid",
  };

  // Initialize the queue and NewsPassID global object
  window.NewsPassIDQ = window.NewsPassIDQ || [];
  window.newspassid = window.newspassid || {
    // Stub method that queues calls until the real implementation loads
    setID: function (id) {
      window.NewsPassIDQ.push(["setID", id]);
    },
    getID: function () {
      window.NewsPassIDQ.push(["getID"]);
      return null;
    },
    getSegments: function () {
      window.NewsPassIDQ.push(["getSegments"]);
      return [];
    },
    clearID: function () {
      window.NewsPassIDQ.push(["clearID"]);
    },
  };

  // Function to load the NewsPassID script
  (function () {
    // Create script element
    var script = document.createElement("script");
    script.src = "https://cdn.example.com/newspassid-async.min.js"; // Use your CDN URL
    script.async = true;

    // Add script to the document
    const head = document.head || document.getElementsByTagName("head")[0];
    head.appendChild(script);
  })();
</script>
```

### API

The NewsPassID SDK provides the following methods:

- `newspassid.getID()` - Get the current NewsPassID
- `newspassid.setID(id)` - Set a custom NewsPassID
- `newspassid.getSegments()` - Get the current segments
- `newspassid.clearID()` - Clear the current NewsPassID

## License

MIT
