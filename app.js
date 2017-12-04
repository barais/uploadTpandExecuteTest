var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var tmp = require('tmp');
var unzip = require('unzip');
var child_process = require('child_process');
var randomstring = require("randomstring");
var nodemailer = require('nodemailer');
const glob = require('glob');
const xml2js = require('xml2js');
var jsel = require('jsel');



var mavenhome = '/opt/apache-maven-3.5.0/';
var isScala = true;
var sendEmail = false;


function sendEmail(content){
  // create reusable transporter object using the default SMTP transport
  var transporter = nodemailer.createTransport('smtps://user%40gmail.com:pass@smtp.gmail.com');

  // setup e-mail data with unicode symbols
  var mailOptions = {
      from: '"Fred Foo ?" <foo@blurdybloop.com>', // sender address
      to: 'bar@blurdybloop.com, baz@blurdybloop.com', // list of receivers
      subject: 'Hello ✔', // Subject line
      text: content // plaintext body
      //html: '<b>Hello world ?</b>' // html body
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, function(error, info){
      if(error){
          return console.log(error);
      }
      console.log('Message sent: ' + info.response);
  });
}

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/upload', function(req, res){

  // create an incoming form object
  var form = new formidable.IncomingForm();

  // specify that we want to allow the user to upload multiple files in a single request
  form.multiples = false;

  // store all uploads in the /uploads directory
  var s = randomstring.generate({
    length: 16,
    charset: 'alphabetic'
  });
  form.uploadDir = path.join(__dirname, '/uploads/'+s);
  fs.mkdirSync(form.uploadDir);
  // every time a file has been uploaded successfully,
  // rename it to it's orignal name

  form.on('file', function(field, file) {
    if (path.extname(file.name).substring(1) == 'zip')
      {
        fs.rename(file.path, path.join(form.uploadDir, file.name));
        var tmpfolder = tmp.dirSync();
        var tmpfolder1 = tmp.dirSync();
        var tmpfolder2 = tmp.dirSync();
        console.log('Dir1: ', tmpfolder.name);
        console.log('Dir2: ', tmpfolder1.name);
        console.log('Dir2: ', tmpfolder2.name);
        fs.createReadStream(path.join(form.uploadDir, file.name)).pipe(unzip.Extract({ path: tmpfolder.name })).on('close', function (entry) {


        var history = child_process.execSync('cp -r templateProjet/* '+ tmpfolder1.name, { encoding: 'utf8' });
        console.log(history);

        var dirProjet = getDirectories(tmpfolder.name)[0];

        if (isScala){
          var history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/src/* '+tmpfolder1.name +'/src/main/scala/' , { encoding: 'utf8' });
          console.log(history);
        }else{
          var history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/src/* '+tmpfolder1.name +'/src/main/java/' , { encoding: 'utf8' });
          console.log(history);
        }
        ///opt/apache-maven-3.2.3/bin/mvn -f /home/barais/git/projetDelfine/pom.xml  clean test
        try {
          var history = child_process.execSync(mavenhome + '/bin/mvn -f '+ tmpfolder1.name + '/pom.xml clean scalastyle:check test' , { encoding: 'utf8' });
         } catch (e) {
          // console.log("Errors:", e);
         }
        
        var ntests = 0;
        var nerrors = 0;
        var nskips = 0;
        var nfailures = 0;

        var files = glob.sync(path.join(tmpfolder1.name  , '/target/surefire-reports/*.xml'));
        files.forEach(function(f) {
             var data = fs.readFileSync(f) ;
             var xml = parseSync(data);
             ntests  = ntests+parseInt(xml.testsuite.$.tests);
             nerrors= nerrors+parseInt(xml.testsuite.$.errors);
             nskips = nskips+parseInt(xml.testsuite.$.skipped);
             nfailures = nfailures +parseInt(xml.testsuite.$.failures);
//                  resjson  = resjson+ JSON.stringify(xml);
//                 });
             //});
         });
         var data = fs.readFileSync(path.join(tmpfolder1.name  , '/scalastyle-output.xml')) ;
         var xml = parseSync(data);
         var dom = jsel(xml);
         var warningstyle = dom.selectAll('(//*/@severity)').filter(word => word ==='warning').length
         var errorstyle = dom.selectAll('(//*/@severity)').filter(word => word ==='error').length
         //console.log(JSON.stringify(xml));


         
         res.end('nombre de tests executés : ' + ntests+'<BR>'+
         'nombre de tests en erreur : ' + nerrors+'<BR>'+
         'nombre de tests non exécutés : ' + nskips+'<BR>'+
         'nombre de tests en échec : ' + nfailures+'<BR>'+
         'nombre de style (scalastyle) en warning : ' + warningstyle+'<BR>'+
         'nombre de style (scalastyle) en erreur : ' + errorstyle+'<BR>'
        );
         
//        var history = child_process.execSync('cat '+ tmpfolder1.name + '/target/surefire-reports/*.xml >' + tmpfolder2.name+'/output.xml', { encoding: 'utf8' });
 //       console.log(history);

 //       fs.readFile(tmpfolder2.name+'/output.xml', function (err, data) {
//          if (err) throw err;
//          console.log(data.toString());
//          res.end(data.toString());

          console.log('will delete ' + tmpfolder.name + ' '+tmpfolder1.name + ' '+tmpfolder2.name + ' ');
        //  var history = child_process.execSync('rm -rf '+ tmpfolder.name + ' '+tmpfolder1.name + ' '+tmpfolder2.name, { encoding: 'utf8' });
          console.log(history);
          if (sendEmail){
            sendEmail(data.toString());
          }
      });
//    });



      }
    else{
      console.log('Your file must be a zip file \n');
      fs.unlinkSync(file.path);
      res.end('Your file must be a zip file')
    }
  });

  // log any errors that occur
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function() {
//    res.end('success');
  });

  // parse the incoming request containing the form data
  form.parse(req);

});

var server = app.listen(3000, function(){
  console.log('Server listening on port 3000');
});


function parseSync (xml) {
  
      // Like wtf? Why is this using a callback when it's not async? So pointless.
      var error = null;
      var json = null;
      var parser = new xml2js.Parser({explicitArray : false});      
      parser.parseString(xml, function (innerError, innerJson) {
  
          error = innerError;
          json = innerJson;
      });
  
      if (error) {
  
          throw error;
      }
  
      if (!error && !json) {
  
          throw new Error('The callback was suddenly async or something.');
      }
  
      return json;
  }
