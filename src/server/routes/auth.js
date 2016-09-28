var express = require('express');
var router = express.Router();
var moment = require('moment');
var jwt = require('jwt-simple');
var request = require('request');
var qs = require('querystring');
var knex = require('knex');

var config = require('./../../../_config');
// var User = require('../models/user.js');

// *** login required *** //
function ensureAuthenticated(req, res, next) {
  if (!(req.headers && req.headers.authorization)) {
    return res.status(400).send({
      message: 'You did not provide a JSON Web Token in the authorization header.'
    });
  }

  // decode the token
  var header = req.headers.authorization.split(' ');
  var token = header[1];
  var payload = jwt.decode(token, config.TOKEN_SECRET);
  var now = moment().unix();

  // check if the token has expired
  if (now > payload.exp) {
    return res.status(401).send({
      message: 'Token has expired. '
    });
  }
}
//   // check if the user still exists in the db
//   User.findById(payload.sub, function(err, user) {
//     if (!user) {
//       return res.status(400).send({
//         message: 'User no longer exists. '
//       });
//     }
//     req.user = user;
//     next();
//   });
// }

// *** generate token *** //
function createToken(user) {
  var payload = {
    exp: moment().add(14, 'days').unix(),
    iat: moment().unix(),
    sub: user._id
  };
  return jwt.encode(payload, config.TOKEN_SECRET);
}

// *** register route (email and password) *** //
// router.post('/signup', function(req, res) {
//   User.findOne({email: req.body.email}, function(err, existingUser) {
//     if (existingUser) {
//       return res.status(409).send({
//         message: 'Email is already taken'
//       });
//     }
//     var user = new User({
//       email: req.body.email,
//       password: req.body.password
//     });
//     user.save(function() {
//       var token = createToken(user);
//       res.send({
//         token: token,
//         user: user
//       });
//     });
//   });
// });

// // *** login route (email and password) *** //
// router.post('/login', function(req, res) {
//   User.findOne({email: req.body.email}, '+password', function(err, user) {
//     if (!user) {
//       return res.status(401).send({
//         message: {
//           email: 'Incorrect email'
//         }
//       });
//     }
//     user.comparePassword(req.body.password, function(err, isMatch) {
//       if (!isMatch) {
//         return res.status(401).send({
//           message: 'Wrong email address and/or password'
//         });
//       }
//       user = user.toObject();
//       delete user.password;
//       var token = createToken(user);
//       res.send({
//         token: token,
//         user: user
//       });
//     });
//   });
// });

// *** update user route *** //
// router.put('/update', ensureAuthenticated, function(req, res) {
//   User.findOne({_id: req.body._id}, function(err, user) {
//     if (!user) {
//       return res.status(401).send({
//         message: {
//           email: 'Incorrect email'
//         }
//       });
//     }
//     user.email = req.body.email;
//     user.save(function() {
//       res.send(user);
//     });
//   });
// });

//
router.post('/github', function(req, res) {
  var accessTokenUrl = 'https://github.com/login/oauth/access_token';
  var userApiUrl = 'https://api.github.com/user';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    redirect_uri: req.body.redirectUri,
    client_secret: process.env.GITHUB_SECRET
  };

  // Step 1. Exchange authorization code for access token.
  request.get({ url: accessTokenUrl, qs: params }, function(err, response, accessToken) {
    accessToken = qs.parse(accessToken);
    var headers = { 'User-Agent': 'Satellizer' };

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: userApiUrl, qs: accessToken, headers: headers, json: true }, function(err, response, profile) {
      // Step 3a. Link user accounts.
      if (req.headers.authorization) {
        return knex('accounts')
        .where('github_id', profile.id)
        .first()
        .then((user) => {
          if (user) {
            return res.status(409).json({ message: 'There is already a GitHub account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, process.env.TOKEN_SECRET);
          const userID = payload.sub;
          return knex('accounts')
          .where('id', userID)
          .first()
          .then((res) => {
            if (!res) {
              return res.status(400).json({
                message: 'User not found'
              });
            }
            // add profile.id to accounts
            return knex('accounts')
            .where('id', userID)
            .update({
              github_id: profile.id
            })
            .returning('*')
            .then((response) => {
              var token = createToken(res);
              res.json({
                token: token,
                user: response
              });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        return knex('accounts')
        .where('github_id', profile.id)
        .first()
        .then((existingUser) => {
          if (existingUser) {
            var token = createToken(existingUser);
            return res.json({
              token: token,
              user: existingUser
            });
          }
          var user = {};
          user.first_name = 'steve';
          user.last_name = 'steve';
          user.email = 'test@test.com';
          user.profile_picture = 'steve';
          user.username = 'steve';
          user.password = 'steve';
          user.tagline = 'steve';
          user.zip_code = '80000';
          user.availability = '36';
          user.gender = 'male';

          var account = {};
          account.is_user = false;
          account.is_admin = false;
          account.github_id = profile.id;

          return knex('accounts')
          .insert(account)
          .returning('id')
          .then((accountID) => {
            user.account_id = accountID;
            knex('players').insert(user)
            .then((yes) => {
              console.log(yes);
            });
            var token = createToken(user);
            return res.json({
              token: token,
              user: user,
              redirect_uri: req.body.redirectUri
            });
          });
        });
      }
    });
  });
});

// // *** google auth *** //
// router.post('/google', function(req, res) {
//   var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token';
//   var peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect';
//   var params = {
//     code: req.body.code,
//     client_id: req.body.clientId,
//     client_secret: config.GOOGLE_SECRET,
//     redirect_uri: req.body.redirectUri,
//     grant_type: 'authorization_code'
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post(accessTokenUrl, { json: true, form: params }, function(err, response, token) {
//     var accessToken = token.access_token;
//     var headers = { Authorization: 'Bearer ' + accessToken };
//
//     // Step 2. Retrieve profile information about the current user.
//     request.get({ url: peopleApiUrl, headers: headers, json: true }, function(err, response, profile) {
//       if (profile.error) {
//         return res.status(500).send({message: profile.error.message});
//       }
//       // Step 3a. Link user accounts.
//       if (req.headers.authorization) {
//         User.findOne({ googleProfileID: profile.sub }, function(err, existingUser) {
//           if (existingUser) {
//             return res.status(409).send({ message: 'There is already a Google account that belongs to you' });
//           }
//           var token = req.headers.authorization.split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function(err, user) {
//             if (!user) {
//               return res.status(400).send({ message: 'User not found' });
//             }
//             user.googleProfileID = profile.sub;
//             user.email = profile.email;
//             user.save(function() {
//               var token = createToken(user);
//               res.send({
//                 token: token,
//                 user: user
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user account or return an existing one.
//         User.findOne({ googleProfileID: profile.sub }, function(err, existingUser) {
//           if (existingUser) {
//             return res.send({
//               token: createToken(existingUser),
//               user: existingUser
//             });
//           }
//           var user = new User();
//           user.googleProfileID = profile.sub;
//           user.email = profile.email;
//           user.save(function(err) {
//             var token = createToken(user);
//             res.send({
//               token: token,
//               user: user
//             });
//           });
//         });
//       }
//     });
//   });
// });

module.exports = router;
