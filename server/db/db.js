const mysql = require('mysql2')
const config = require('./config').db

//连接数据库
module.exports = mysql.createConnection(config)