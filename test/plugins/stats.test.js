const request = require('supertest')
const express = require('express')
const nock = require('nock')
const plugin = require('../../lib/plugins/stats')

const helper = require('./helper')

describe('stats', function () {
  let robot, server


  beforeEach(() => {
    // Clean up env variable
    delete process.env.DISABLE_STATS
  })
  
  const query = `query ($query: String!) {
          search(first: 10, type: REPOSITORY, query: $query) {
            nodes {
              ... on Repository {
                name
                stargazers {
                  totalCount
                }
                owner {
                  login
                }
              }
            }
          }
        }`
  const variables = {"query": "org:test sort:stars stars:>=1"}

  beforeEach(async () => {
    nock('https://api.github.com')
     .defaultReplyHeaders({'Content-Type': 'application/json'})
     .post('/installations/1/access_tokens').reply(200, {token: 'test'})
     .get('/app/installations?per_page=100').reply(200, [{id: 1, account: {login: 'testing'}}])
     .get('/installation/repositories').reply(200, {repositories: [
       {private: true, stargazers_count: 1},
       {private: false, stargazers_count: 2}
     ]})
    .post('/graphql').reply(200, {
      "data": {
        "search": {
          "nodes": [
          {
            "name": "test-repo",
            "stargazers": {
              "totalCount": 2
            },
            "owner": {
              "login": "test"
            }
          }]
        }}
      })

    robot = helper.createRobot()

    await plugin(robot)

    server = express()
    server.use(robot.router)

  describe('GET /probot/stats', () => {
    beforeEach(async () => {
      nock('https://api.github.com')
       .defaultReplyHeaders({'Content-Type': 'application/json'})
       .post('/installations/1/access_tokens').reply(200, {token: 'test'})
       .get('/app/installations?per_page=100').reply(200, [{id: 1, account: {login: 'testing'}}])
       .get('/installation/repositories?per_page=100').reply(200, {repositories: [
         {private: true, stargazers_count: 1},
         {private: false, stargazers_count: 2}
       ]})

      robot = helper.createRobot()

      await plugin(robot)

      server = express()
      server.use(robot.router)
    })

    it('returns installation count and popular accounts', () => {
      return request(server).get('/probot/stats')
        .expect(200, {'installations': 1, 'popular': { test: { stars: 2 }}})
    })
  })

  describe('can be disabled', () => {
    beforeEach(async () => {
      process.env.DISABLE_STATS = 'true'

      robot = helper.createRobot()

      await plugin(robot)

      server = express()
      server.use(robot.router)
    })

    it('/probot/stats returns 404', () => {
      return request(server).get('/probot/stats').expect(404)
    })
  })
})
