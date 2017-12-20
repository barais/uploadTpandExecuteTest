var express = require('express');
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var tmp = require('tmp');
var extract = require('extract-zip');
var child_process = require('child_process');
var randomstring = require("randomstring");
var nodemailer = require('nodemailer');
const glob = require('glob');
const xml2js = require('xml2js');
var jsel = require('jsel');


var app = express();


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
  var error = false;
  var errorcode =0;
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
       // console.log('Dir1: ', tmpfolder.name);
       // console.log('Dir2: ', tmpfolder1.name);
//        console.log('Dir2: ', tmpfolder2.name);
      extract(path.join(form.uploadDir, file.name), {dir: tmpfolder.name}, function (err) {
       // extraction is complete. make sure to handle the err
    


        var history = child_process.execSync('cp -r templateProjet/* '+ tmpfolder1.name, { encoding: 'utf8' });
        console.log(history);

        var dirProjet = getDirectories(tmpfolder.name)[0];

        if (dirProjet !=null){
        if (isScala){
          try {
            var history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/src/* '+tmpfolder1.name +'/src/main/scala/' , { encoding: 'utf8' });
          } catch (e) {
              error = true;
              errorcode=1;
          }
          console.log(history);
          try {
            
            history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/tests/* '+tmpfolder1.name +'/src/test/scala/' , { encoding: 'utf8' });
        }catch (e) {
          errorcode=2;
          error = true;
      }
      
          console.log(history);
          try {
            if (fs.existsSync(path.join(tmpfolder.name + '/'+dirProjet+'/img'))) {          
              history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/img '+tmpfolder1.name +'/src/main/resources/' , { encoding: 'utf8' });
            }
        }catch (e) {
          errorcode=3;
          error = true;
      }
      
          console.log(history);
          try {
            history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/*.jar '+tmpfolder1.name +'/lib/' , { encoding: 'utf8' });
        }catch (e) {
          error = true;
          errorcode=4;            
          //          continue;
      }
      
          console.log(history);
          
        }else{
          try {
            var history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/src/* '+tmpfolder1.name +'/src/main/java/' , { encoding: 'utf8' });
          }catch (e) {
            errorcode=1;            
            error = true;
  //          continue;
        }
            console.log(history);
        }
      }else{
        res.end('Bad zip');
        return;        
      }
        ///opt/apache-maven-3.2.3/bin/mvn -f /home/barais/git/projetDelfine/pom.xml  clean test

        var files = glob.sync(path.join(tmpfolder1.name  , '/lib/*.jar'));
        var replacement = '';
        var libn = 0;
        files.forEach(function(f) { 
          replacement = replacement+ "<dependency><artifactId>delfinelib"+libn+"</artifactId><groupId>delfinelib</groupId><version>1.0</version><scope>system</scope><systemPath>${project.basedir}/lib/"+path.basename(f)+"</systemPath></dependency>"
          libn = libn+1;
        });
        data = fs.readFileSync(path.join(tmpfolder1.name + '/pom.xml'), 'utf8'); 
        //console.log(replacement);
        var result = data.replace('<!--deps-->', replacement  );        
//        console.log(result);     
        fs.writeFileSync(path.join(tmpfolder1.name + '/pom.xml'), result, 'utf8');

        try {
          var history = child_process.execSync(mavenhome + '/bin/mvn -f'+ tmpfolder1.name + '/pom.xml clean scalastyle:check test -Dmaven.test.failure.ignore=true' , { encoding: 'utf8' });
         } catch (e) {
           console.log(e);
          error = true;
          errorcode=5;          
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
         });

         if (fs.existsSync(path.join(tmpfolder1.name  , '/scalastyle-output.xml'))) {
    // Do something
            var data = fs.readFileSync(path.join(tmpfolder1.name  , '/scalastyle-output.xml')) ;
            var xml = parseSync(data);
            var dom = jsel(xml);
            var warningstyle = dom.selectAll('(//*/@severity)').filter(word => word ==='warning').length
            var errorstyle = dom.selectAll('(//*/@severity)').filter(word => word ==='error').length
         //console.log(JSON.stringify(xml));
         }else{
          errorcode=6;
           error = true;
         }
         if (!error){
         
          res.end('nombre de tests executés : ' + ntests+'<BR>'+
          'nombre de tests en erreur : ' + nerrors+'<BR>'+
          'nombre de tests non exécutés : ' + nskips+'<BR>'+
          'nombre de tests en échec : ' + nfailures+'<BR>'+
          'nombre de style (scalastyle) en warning : ' + warningstyle+'<BR>'+
          'nombre de style (scalastyle) en erreur : ' + errorstyle+'<BR>'
          );
        }else{
          if (errorcode==0){
            res.end('Projet en erreur');            
          } else if (errorcode==1){
            res.end('Projet en erreur pas de sources');            
          } else if (errorcode==2){
            res.end('Projet en erreur pas de tests');            
          }else if (errorcode==3){
            res.end('Projet en erreur pas d\'images');            
          }else if (errorcode==4){
            res.end('Projet en erreur pas de librairies');            
          }else if (errorcode==5){
            res.end('Projet en erreur ne compile pas. Erreur exécution maven');            
          }else if (errorcode==6){
            res.end('Projet en erreur, pas d\'exécution du check syntaxique');            
          }

          
          
        }
//        var history = child_process.execSync('cat '+ tmpfolder1.name + '/target/surefire-reports/*.xml >' + tmpfolder2.name+'/output.xml', { encoding: 'utf8' });
 //       console.log(history);

 //       fs.readFile(tmpfolder2.name+'/output.xml', function (err, data) {
//          if (err) throw err;
//          console.log(data.toString());
//          res.end(data.toString());

        //  console.log('will delete ' + tmpfolder.name + ' '+tmpfolder1.name + ' '+tmpfolder2.name + ' ');
          var history = child_process.execSync('rm -rf '+ tmpfolder.name + ' '+tmpfolder1.name + ' '+tmpfolder2.name, { encoding: 'utf8' });
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
