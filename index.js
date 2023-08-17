const express = require("express");
const { default: puppeteer } = require("puppeteer");

const nodemailer = require('nodemailer');
const cron = require('node-cron');
const ehbs = require('nodemailer-express-handlebars')
const path = require('path');
require('dotenv').config()
const bodyparser = require('body-parser')
const mongoose = require('mongoose');
const users = require('./models/schema')

const app = express();

const port = process.env.PORT || 80;

//setting the view directory
app.set('views',path.join(__dirname,'/views'));    
app.use(bodyparser.urlencoded({extended:false}))
app.use(express.json())
app.set('view engine','hbs');
app.use(express.static('public'))


//connection to mongoose atlas cloud
mongoose.connect(process.env.MONGO_URL,{useNewUrlParser : true})
.then(()=>{
    console.log("Database Connected!")
})
.catch((err)=>{
    console.log(err);
})

// Setting Routes
app.get('/',(req,res)=>{
    res.render('index')
})

// Define the home route
app.get('/home',(req,res)=>{
    res.render('index')
})
app.post('/',(req,res)=>{
    const userName = req.body.name;
    const userEmail = req.body.email;

    console.log(userName + " \n"+ userEmail )

    const user = new users({
        name : userName,
        email : userEmail
    })

    user.save((err,doc)=>{
        if(!err){

            res.render('subscribed');
        }
        else{
            console.log("Error is : "+err)
        }
    })

})

// Define the unsubscribe route
app.get('/unsubscribe', (req, res) => {
    res.render('unsubscribe')
  });
  
  // Define the post route for the unsubscribe page
  app.post('/unsubscribe', (req, res) => {
    const email = req.body.email;
  
    // Delete the user with the specified email
    users.deleteOne({ email: email }, (err) => {
      if (err) {
        console.log(err);
      } else {
      
      // res.send(`You have successfully unsubscribed from our service.`);
      console.log(email+" Unsubscribed successfully")
      res.render('index');
      }
    });
  });

  users.find({}, function(err, users) {
    if (err) {
      console.error(err);
    } else {
      const nameList = [];
      const emailList = [];
  
      users.forEach(function(user) {
        nameList.push(user.name);
        emailList.push(user.email);
      });
  
      console.log("Name list:", nameList);
      console.log("Email list:", emailList);
    }
});



// * * * * *,         *1: minutes *2: hours *3: day of month *4which month to choose *5day of week , to execute for every sec keep all stars, for every 30 min : 30 * * * *
cron.schedule('30 10,14 * * *', async()=>{
    // console.log('cron is working..'); //schedule at 10:30 and 2:30 daily
    scrapChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100');
})


var StockApi;


//puppeter for web scrapping
async function scrapChannel(url){
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      args: ['--no-sandbox']
    });
    const page =  await browser.newPage();
    await page.goto(url);
    //puppeteer will a open a page in backgroup containning url



    // e1-Element1 Stock Name
    // selecting stock1 from from top losers of Nifty 100
    const [el] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[1]/a')
    const text =  await el.getProperty('textContent'); //extracting text content proprty from element 1
    const stockName = await text.jsonValue();
    
    //el -2 Element 2 Stock price
    const [el2] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/text()')
    const priceSrc = await el2.getProperty('textContent');
    const priceVal = await priceSrc.jsonValue();

    //el -3 Element 3 52 week low
    const [el3] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[4]')
    const lowSrc = await el3.getProperty('textContent');
    const lowVal = await lowSrc.jsonValue();

    //el -4 Element 52 Week High
    const [el4] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[5]')
    const highSrc = await el4.getProperty('textContent');
    const highVal = await highSrc.jsonValue();

    //el -2 Down percentage
    const [el5] = await page.$x('/html/body/div/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/div')
    const downBy = await el5.getProperty('textContent');
    const downVal = await downBy.jsonValue();

    //extracting percentage from downvalue using regular expression
    var downValMod = downVal.replace(/\(.*?\)/gm,""); //removes values after downBy which are in bracket
    downValMod = downValMod.replace(/\-/g,""); 
    
    //cal percentage down by current market price / downbyPrice so extracting individual components
    var priceValMod = priceVal.replace(/\₹/g,"");  


    var currentPrice = parseFloat(priceValMod.replace(",", ""));
    var downToday = parseFloat(downValMod.replace(",", ""));

    let denom = currentPrice+downToday;

    // console.log("Denom: "+denom);
    
    let pTemp = (downToday/denom)*100;
    let percentage = parseFloat(pTemp).toFixed(2);

    
    //creating a function which will send an email when a particular stock is let say downBy 10 %
    if(true){ //percentage * 100 < 1000
        function sendMail(){
            const mailTransporter = nodemailer.createTransport({
                service : 'gmail',
                auth:{
                    user : process.env.GID,
                    pass : process.env.GPW
                },
                tls : {
                    rejectUnauthorized : false
                }
            });


            //set handle bar view engine for mail template
            const handlebarOptions = {
                viewEngine: {
                extName : ".handlebars",
                partialsDir : path.resolve('./views'),
                defaultLayout : false,
            },
            viewPath : path.resolve('./views'),
            extName : ".handlebars",
           }
           mailTransporter.use('compile',ehbs(handlebarOptions));

           users.find({}, function(err, users) {
            if (err) {
              console.error(err);
            } else {
              const nameList = [];
              const emailList = [];
          
              users.forEach(function(user) {
                nameList.push(user.name);
                emailList.push(user.email);
              });
          
              console.log("Name list:", nameList);
              console.log("Email list:", emailList);
          
              // iterate through the name and email lists
              for (let i = 0; i < nameList.length; i++) {
                const name = nameList[i];
                const email = emailList[i];
                const mailOptions = {
                    from : process.env.GID,
                    // to : process.env.GTO,
                    bcc : email,
                    subject : `Market Update: ${stockName} is down by ${percentage}% Today`,
                    // text : `Your stock ${stockName} is down by ${downVal}, current market price is: ${priceVal}, 52 week low of ${stockName} is ${lowVal} while 52 week high is : ${highVal}.`
                    // now using handlebar we can semd html to mail 
                    // HTML: <p>Your stock ${stockName} is down by ${downVal}, current market price is: ${priceVal}</p>,
                    template : 'email',
                    context : {
                        userN : name,
                        name : stockName,
                        pct : percentage,
                        currentPrice : priceVal,
                        lowPrice : lowVal,
                        highPrice : highVal
                    }
                };
                
                // send the email using the nodemailer transporter
                mailTransporter.sendMail(mailOptions, function(error, info) {
                  if (error) {
                    console.log(error);
                  } else {
                    console.log(`Email sent to ${name} at ${email}: ` + info.response);
                  }
                });
            }
        }
          });
        }

        sendMail();
        //templates for mail using handle bars 

    }
    console.log("Stock is Down by: "+percentage+"%");



    stockApi = {
        stocksName : stockName,
        currentPrice : priceVal,
        lowPrice : lowVal,
        highPrice: highVal,
        downBy : downVal
    }
    console.log(stockApi);

    browser.close();

}

scrapChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100');
// scrapChannel('https://groww.in/markets/52-week-high?index=GIDXNIFTY500');

app.listen(port,()=>{
    console.log(`Server is listening at port ${port}`);
    
})