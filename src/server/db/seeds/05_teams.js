const faker = require('faker');

function randomGender() {
  var genderNum = (Math.floor(Math.random() * 2) + 1);
  if (genderNum === 1) {
    return 'male';
  } else {
    return 'female';
  }
}

function teamsSeed(knex) {
  return knex('teams').insert({
    name: (faker.hacker.ingverb() + ' ' + faker.hacker.noun() + 's'),
    image: '../../images/teams/teamplaceholder1.jpg',
    zip: (80000 + (Math.floor(Math.random() * 20) + 1)),
    gender: randomGender(),
    coed: faker.random.boolean(),
    sports_id: faker.random.number({min:1, max:11})
  });
}

exports.seed = function (knex, Promise) {
  const iterationArray = new Array(50);

  var ArrayOfPromises = Array.from(iterationArray)
  .map(() => {
    return teamsSeed(knex);
  });

  return Promise.all(ArrayOfPromises);
};
