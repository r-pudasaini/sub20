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

http.createServer((req, res) => { 

    const parsedUrl = url.parse(req.url);

    // avoids directory traversal attacks
    const sanitizedPath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');

    if (sanitizedPath === "/api/verify-login")
    {
        res.statusCode = 200
        res.setHeader('Content-type', 'text/html')
        res.end("In the API verification endpoint")
        return;

        // TODO: here, we will verify the client through the cookie they sent. 
        // we should be looking at the 'auth-token' cookie
        // if they did not provide the cookie we wanted, or the cookie is invalid, we will return a 401
        // if they do provide the cookie, we return a 200 response along with a 
    }


    let pathname = path.join("../webapp/", sanitizedPath);

    if (!fs.existsSync(pathname))
    {
        res.statusCode = 404;
        fs.readFile("../webapp/index.html", function(err, data) {
            if (err)
            {
                res.end(`File ${pathname} not found!`);
                return;
            }
            else
            {
                // supports client-side routing, which we use in the front
                res.setHeader('Content-type', 'text/html')
                res.end(data)
            }
        })
        return;
    }
  
    // if is a directory, then serve index.html
    if (fs.statSync(pathname).isDirectory()) {
        pathname += '/index.html';
    }
  
    // send the file they want
    fs.readFile(pathname, function(err, data){
        if(err){
            res.statusCode = 500;
            res.end(`Error getting the file: ${err}.`);
        } else {
            const ext = path.parse(pathname).ext;
            res.setHeader('Content-type', mimeType[ext] || 'text/html' );
            res.end(data);
        }
    });

}).listen(parseInt(PORT));

console.log(`Listening on port ${PORT}`)