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
var resultFile='result.csv';

var mavenhome = '/opt/apache-maven-3.5.0/';
var isScala = true;

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter(function(file) {
      return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}

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
  

if (process.argv[2]<3){
    console.log("Please provide the folder to analyse");
    process.exit;
}
var s = ''+process.argv[2];
console.log(s);

fs.writeFileSync(resultFile,'Nom étudiant;nombre de tests executés,nombre de tests en erreur;nombre de tests non exécutés;nombre de tests en échec;'+
'nombre de style (scalastyle) en warning;nombre de style (scalastyle) en erreur\n');

var zipfiles = glob.sync(path.join(s  , '/*.zip'));
zipfiles.forEach(function(file) {
    console.log(file);
    if (path.extname(file).substring(1) == 'zip'){
        var tmpfolder = tmp.dirSync();
        var tmpfolder1 = tmp.dirSync();
        console.log('Dir1: ', tmpfolder.name);
        console.log('Dir2: ', tmpfolder1.name);
        fs.createReadStream(path.join(file)).pipe(unzip.Extract({ path: tmpfolder.name }))
        .on('close', function (entry) {
            var history = child_process.execSync('cp -r templateProjet/* '+ tmpfolder1.name, { encoding: 'utf8' });
            var dirProjet = getDirectories(tmpfolder.name)[0];
            if (isScala){
                var history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/src/* '+tmpfolder1.name +'/src/main/scala/' , { encoding: 'utf8' });
                console.log(history);
            }else{
                var history = child_process.execSync('cp -r '+ tmpfolder.name + '/'+dirProjet+'/src/* '+tmpfolder1.name +'/src/main/java/' , { encoding: 'utf8' });
                console.log(history);
            }
            try {
                var history = child_process.execSync(mavenhome + '/bin/mvn -f '+ tmpfolder1.name + '/pom.xml clean scalastyle:check test' , { encoding: 'utf8' });
            } catch (e) {
                /* console.log("Errors:", e);*/
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
            var data = fs.readFileSync(path.join(tmpfolder1.name  , '/scalastyle-output.xml')) ;
            var xml = parseSync(data);
            var dom = jsel(xml);
            var warningstyle = dom.selectAll('(//*/@severity)').filter(word => word ==='warning').length
            var errorstyle = dom.selectAll('(//*/@severity)').filter(word => word ==='error').length
            fs.appendFileSync(resultFile,file+';'+ntests+';'+ nerrors +';'+ nskips +';'+ nfailures +';'+ warningstyle +';'+ errorstyle +'\n');
            console.log('will delete ' + tmpfolder.name + ' '+tmpfolder1.name );
            var history = child_process.execSync('rm -rf '+ tmpfolder.name + ' '+tmpfolder1.name , { encoding: 'utf8' });
        });
    }
});
