// Importing necessary modules 
const http = require('http'); 
const url = require('url'); 
const fs = require('fs'); 
const path = require('path'); 
   
// Port on which the server will create 
const PORT = 10201; 
   
// Maps file extension to MIME types which 
// helps the browser to understand what to 
// do with the file 
const mimeType = { 
    '.ico': 'image/x-icon', 
    '.html': 'text/html', 
    '.js': 'text/javascript', 
    '.json': 'application/json', 
    '.css': 'text/css', 
    '.png': 'image/png', 
    '.jpg': 'image/jpeg', 
    '.wav': 'audio/wav', 
    '.mp3': 'audio/mpeg', 
    '.svg': 'image/svg+xml', 
    '.pdf': 'application/pdf', 
    '.doc': 'application/msword', 
    '.eot': 'application/vnd.ms-fontobject', 
    '.ttf': 'application/font-sfnt'
}; 

http.createServer( (req, res) => { 
    console.log(`${req.method} ${req.url}`);

    const parsedUrl = url.parse(req.url);

    // extract URL path
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    // e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
    // by limiting the path to current directory only
    const sanitizePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
    let pathname = path.join("../webapp/", sanitizePath);
  
    fs.exists(pathname, function (exist) {

      if(!exist) {
        // if the file is not found, return 404
        res.statusCode = 404;
        fs.readFile("../webapp/index.html", function(err, data) {
            if (err)
            {
                res.end(`File ${pathname} not found!`);
                return;
            }
            else
            {
                res.setHeader('Content-type', 'text/html')
                res.end(data)
            }
        })
        return;
      }
  
      // if is a directory, then look for index.html
      if (fs.statSync(pathname).isDirectory()) {
        pathname += '/index.html';
      }
  
      // read file from file system
      fs.readFile(pathname, function(err, data){
        if(err){
          res.statusCode = 500;
          res.end(`Error getting the file: ${err}.`);
        } else {
          // based on the URL path, extract the file extention. e.g. .js, .doc, ...
          const ext = path.parse(pathname).ext;
          // if the file is found, set Content-type and send data
          res.setHeader('Content-type', mimeType[ext] || 'text/html' );
          res.end(data);
        }
      });
    }); 
}).listen(PORT); 

console.log("Listening on port 10201")