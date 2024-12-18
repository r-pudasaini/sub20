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
  
}).listen(PORT); 