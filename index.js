const cookieParser = require("cookie-parser")
const session = require('express-session')
const jwt = require('jsonwebtoken')
const express = require('express')
const bcrypt = require('bcrypt')
const cors = require('cors')
const fs = require('fs')

const maxAge = 60*60*24
const app = express()
const PORT = 3000


let database = JSON.parse(fs.readFileSync('./database/database.json', 'utf-8'))
fs.watchFile('./database/database.json', (curr, prev) => {
  database = JSON.parse(fs.readFileSync('./database/database.json', 'utf-8'))
})

const createToken = (id) => {
  return jwt.sign({id}, 'gizli soz', {expiresIn: maxAge})
}


app.use(cors())
app.use(express.json())
app.use(cookieParser())
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(session({ secret: 'gizli soz', resave: true, saveUninitialized: true }));


app.get('/', (req, res) => {
  res.render('mainpage')
})

app.get('/blog', (req, res) => {
  res.render('blog')
})

app.get('/about', (req, res) => {
  res.render('about')
})


app.get("/quiz", async (req, res) => {
  let token = req.cookies.token;
  if (token) {
    let userdata = null
    await jwt.verify(token, 'gizli soz', (err,decodedToken) => {
      if (err) {
        console.log(err)
      }
      if (decodedToken) {
        userdata = database.users.find((el) => el.id === decodedToken.id)
      }
    }) 
    if (userdata) {
      imtahanData = {};
      for (var k = 0; database.quizler.length; k++) {
        if (database.quizler[k].info.id == req.query.id) {
          imtahanDataTemplate = database.quizler[k].questions.sort(
            () => Math.random() - 0.5
          );
          var maks = imtahanDataTemplate.length;
          var min = 0;
          var numb = Math.floor(Math.random() * (maks - min) + min);
          imtahanData = imtahanDataTemplate[numb];
          break;
        }
      }
      res.render("imtahan", { sual: imtahanData, duzsayi:userdata.duzsayi, movzuId: req.query.id });
    } else {
    res.redirect("/panel-login");
  }
  } else {
    res.redirect("/panel-login");
  }
});


app.get('/panel', async (req, res) => {
  let token = req.cookies.token
  if (token) {
    let userdata = null
    await jwt.verify(token, 'gizli soz', (err,decodedToken) => {
      if (err) {
        console.log(err)
      }
      if (decodedToken) {
        userdata = database.users.find((el) => el.id === decodedToken.id)
      }
    })
    if (userdata) {
      req.session.loggedin = true
      let sinaqlar = []
    for (var z=0; z<database.quizler.length; z++) {
      sinaqlar.push(database.quizler[z].info)
    }
      if (userdata.isadmin) {
        res.render('admin-panel', {sinaqlar: sinaqlar, user: userdata})
      } else{
        res.render('panel', {sinaqlar: sinaqlar, user: userdata})
      }
      } else{
    res.render('panel-login')
  }
  } else{
    res.render('panel-login')
  }
})

app.get('/panel-login', (req, res) => {
  res.render('panel-login')
})

app.get('/panel/signup', (req, res) => {
  res.render('panel-register')
})

app.get('/admin-panel/dashboard', async (req, res) => {
  let serverStats = database.serverStats
  let token = req.cookies.token
  if (token) {
    let userdata = null
    await jwt.verify(token, 'gizli soz', (err,decodedToken) => {
      if (err) {
        console.log(err)
      }
      if (decodedToken) {
        userdata = database.users.find((el) => el.id === decodedToken.id)
      }
    })
    if (userdata) {
      req.session.loggedin = true
      if (userdata.isadmin) {
        res.render('admin-dashboard', {user: userdata, serverStats: serverStats})
      } else{
        res.render('panel', {sinaqlar: sinaqlar, user: userdata})
      }
      } else{
    res.render('panel-login')
  }
  } else{
    res.render('panel-login')
  }
})

app.post("/panel/signup", async (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  let name = req.body.name;
  if (name && email && password) {
    if (req.body.password == req.body.passwordagain) {
      if (database.users.find((el) => el.email === email)) {
        res
          .status(404)
          .render("404", { err: "Sistemdə belə bir istifadəçi mövcuddur." });
      } else {
        const salt = await bcrypt.genSalt(1);
        let userpass = await bcrypt.hash(password, salt);
        let userScheme = {
          id: Math.floor(Date.now()*(Math.random()*(50 - 2)+2)),
          name: name.toString(),
          email: email.toString(),
          password: userpass.toString(),
        };
        console.log("[LOG] Yeni istifadeci " + name + " aramiza qatildi!");
        await fs.writeFile(
          "./database/database_backup.json",
          JSON.stringify(database),
          function (err, result) {
            if (err) {
              console.log("error", err);
            }
          }
        );
        database.users.push(userScheme);
        await fs.writeFile(
          "./database/database.json",
          JSON.stringify(database),
          function (err, result) {
            if (err) {
              console.log("error", err);
            }
          }
        );
        res.render('panel-login')
      }
    } else {
      res.status(404).render("404", { err: "Yazdığınız şifrə uyğun deyil." });
    }
  } else {
    res.status(404).render("404", {
      err: "Yazdığınız şifrə, ad və ya e-poçt boş olmamalıdır.",
    });
  }
});

app.post("/panel/login", async (req, res) => {
  let email = req.body.email
  let password = req.body.password
  if (req.session.loggedin) {
    res.redirect("/panel");
  } else {
    if (email && password) {
      for (var user in database.users) {
        if (database.users[user].email == email) {
          const validPassword = await bcrypt.compare(
            password,
            database.users[user].password
          );
          if (validPassword) {
            req.session.loggedin = true;
            const token = createToken(database.users[user].id)
            res.cookie('token', token,{httpOnly: true, secure: true, maxAge: maxAge * 1000})
            if (database.users[user].admin == true) {
              res.redirect("/panel");
              break;
            } else {
              res.redirect("/panel");
              break;
            }
          } else {
            res.send("Xətalı e-poçt və ya şifrə.");
            break;
          }
        }
      }
    } else {
      res
        .status(404)
        .render("404", { err: "Yazdığınız şifrə və ya e-poçt uyğun deyil." });
    }
  }
});

app.post('/quiz', async (req, res) => {
  let token = req.cookies.token
  var nk = null;
  if (token) {
    let userdata = null
    await jwt.verify(token, 'gizli soz', (err,decodedToken) => {
      if (err) {
        console.log(err)
      }
      if (decodedToken) {
        for (var k=0; k<database.users.length; k++) {
          if (database.users[k].id == decodedToken.id) {
            userdata = database.users[k].id
            nk = k
            break
          }
        }
        userdata = database.users.find((el) => el.id === decodedToken.id)
      }
    })
    if (userdata) {
    let parameters = req.body
  let movzu = database.quizler.find((el) => el.info.id === parameters.mainId)
  if (movzu) {
    let sual = movzu.questions.find((el) => el.id === parameters.id)
    if (sual) {
      if (sual.correctVariant == parameters.answer) {
        database.users[nk].duzsayi++
        database.serverStats.completedQuiz++
        await fs.writeFile(
          "./database/database_backup.json",
          JSON.stringify(database),
          function (err, result) {
            if (err) {
              console.log("error", err);
            }
          }
        );
        await fs.writeFile(
          "./database/database.json",
          JSON.stringify(database),
          function (err, result) {
            if (err) {
              console.log("error", err);
            }
          }
        );
        res.send(true)
      } else {
        res.send(false)
      }
    }
  }
    } else {
    res.redirect('/panel')
  }
  } else {
    res.redirect('/panel')
  }
})

app.get("/panel/logout", (req, res) => {
  res.cookie('token', '',{httpOnly: true, secure: true, maxAge: 1})
  req.session.loggedin = false
  res.redirect('/panel')
})


app.listen(PORT, () => { console.log(`Server listening on ${PORT}`) })