var express = require("express");
var app = express();
var path = require("path");
var cors = require('cors');
var http=require('http').Server(app);
var router = require('./router')
var io = require('socket.io')(http);

app.use(cors());
app.use('/', router);
app.use('/', express.static(path.join(__dirname, 'static')));

io.on('connection', function(socket){
  console.log('a user connected');
});

app.listen(8080, () => {
    console.log("Listener has started");
});

