const express = require("express");
const secrets = require("./secrets/onedrive/secrets.json");
const axios = require("axios");
const url = require("url");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data/data.sqlite");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});
const dataAccess = require("./dataAccess.js");

const app = express();
const uri = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${
  secrets.client_id
}&scope=${secrets.scopes.join("%20")}&response_type=${
  secrets.response_type
}&redirect_uri=${secrets.redirect_uri}`;
const pass = process.env.pass

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
db.run(
  "CREATE TABLE IF NOT EXISTS paths (path TEXT NOT NULL UNIQUE PRIMARY KEY)"
);

const prompts = [
  { name: "Redo Auth", desc: "Redo for Microsoft Authentication" },
  { name: "Add Path", desc: "Adds path to internal db for backing up" },
  { name: "Exit", desc: "Exit program(Stops server)" },
];
dataAccess.init();
var combineString = "";
for (let i = 0; i < prompts.length; i++) {
  var temp = `[${i}]	${prompts[i].name}	  (${prompts[i].desc})\n`;
  combineString = combineString.concat(temp);
}
readline.setPrompt(combineString);

app.get("/", async (req, res) => {
  resCode = req.query["code"];
  res.write(resCode);
  res.statusCode = 200;
  res.end();
  await redeemCode(resCode);
});
app.post("/backup", (req, res) => {
  var checkPass = req.body.pass;
  if(pass == checkPass) {
    var toBackup = req.body.cons;

    console.log("[M] Valid Backup request received. Starting Backup for: \n");

    //for(let i = 0; i < toBackup.length, i++) {
    //  console.log(`(${i}) ${toBackup[i]}`);
    //}
    console.log(toBackup);

    if(toBackup == "all") {
      process.stdout.write("[M] Backing Up Files And Folders...");
      dataAccess.backupPaths();
      process.stdout.write("Done\n[M] Backing Up Databases...");
      dataAccess.backupDB();

      var backupPath = `/backup.${dataAccess.getDate()}.zip`;
      process.stdout.write("Done\n[M]Compressing Backups to zip...");
      dataAccess.zipBackup(backupPath);
      console.log(`Done! Backup has been written to ${backupPath}`);

    } else if(toBackup == "paths") {
       process.stdout.write("[M] Backing Up Files And Folders...");
       dataAccess.backupPaths(function (){

         var backupPath = `/backup.${dataAccess.getDate()}.zip`;
         process.stdout.write("Done\n[M]Compressing Backups to zip...");
         dataAccess.zipBackup(backupPath);
         console.log(`Done! Backup has been written to ${backupPath}`);

      });

    } else if(toBackup == "dbs") {
      process.stdout.write("[M] Backing Up Databases...");
      dataAccess.backupDB(function (){

        var backupPath = `/backup.${dataAccess.getDate()}.zip`;
        process.stdout.write("Done\n[M]Compressing Backups to zip...");
        dataAccess.zipBackup(backupPath);
        console.log(`Done! Backup has been written to ${backupPath}`);

      });
    }

  }
})

async function redeemCode(code) {
  var data = new url.URLSearchParams({
    client_id: secrets.client_id,
    redirect_uri: secrets.redirect_uri,
    client_secret: secrets.client_secret,
    code: code,
    grant_type: "authorization_code",
  });
  console.log(data.toString());
  let x = await axios.post(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    data.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
    (err, res) => {
      if (err) return console.log(err);
      console.log("nores");
      console.log(res);
    }
  );
  readline.prompt();
  console.log(x);
}
if (secrets.access_token == "") {
  console.log(`Visit this url and login with your account: ${uri}`);
} else {
  console.log("Access token found\n");
}

readline.on("line", (choice) => {
  switch (choice) {
    case "0":
      console.log(`Visit this url and login with your account: ${uri}`);
      console.log(combineString);
      break;
    case "1":
      readline.question("Path to folder/file to be backed up: ", (path) => {
        db.run(`INSERT INTO paths VALUES ("${path}")`);
        console.log("Added to DB\n");
        console.log(combineString);
      });
      break;
    case "2":
      process.kill(process.pid, "SIGINT");
  }
});
readline.prompt();
app.listen(8080);
