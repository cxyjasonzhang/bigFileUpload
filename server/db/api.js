//api.js

const connection = require('./db')

//查询
const getAccount = () => {
  return new Promise((resolve, reject) => {
    //第一个参数：sql语句
    //第二个参数：回调函数（err：查询错误，data：查询结果）
    connection.query("select * from account",(err,data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}
//添加
const insertAccount = (param) => {
  return new Promise((resolve,reject) => {
    connection.query("insert into account(username,phone,password) values(?,?,?)",param,(err,data) => {
      //如果err为null则成功
      if (err) return reject(err)
      resolve(data)
    })
  })
}
//改
const updateAccount = (param) => {
  return new Promise((resolve,reject) => {
    connection.query("update account set username = ? where phone = ?",param,(err,data) => {
      //如果err为null则成功
      if (err) return reject(err)
      resolve(data)
    })
  })
}

//删除
const deleteAccount = (param) => {
  return new Promise((resolve,reject) => {
    connection.query("delete from account where id = ?",param,(err,data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

/**
 * 查询 user 表（分页 + 搜索）
 * @param {object} params - { username?, phone?, page, pageSize }
 * @returns {Promise<{list: Array, total: number}>}
 */
const getUserList = ({ username, phone, page, pageSize }) => {
  return new Promise((resolve, reject) => {
    // 构建动态 WHERE 条件
    const conditions = [];
    const params = [];

    if (username) {
      conditions.push("username LIKE ?");
      params.push(`%${username}%`);
    }
    if (phone) {
      conditions.push("phone LIKE ?");
      params.push(`%${phone}%`);
    }

    const whereClause = conditions.length > 0
      ? "WHERE " + conditions.join(" AND ")
      : "";

    // 1. 先查总数
    const countSQL = `SELECT COUNT(*) AS total FROM \`user\` ${whereClause}`;

    connection.query(countSQL, params, (err, countResult) => {
      if (err) return reject(err);

      const total = countResult[0]?.total || 0;

      // 2. 再查分页数据（AS 别名转驼峰）
      const dataSQL = `
        SELECT id, username, phone,
               home_address AS homeAddress,
               work_location AS workLocation
        FROM \`user\`
        ${whereClause}
        ORDER BY id ASC
        LIMIT ? OFFSET ?
      `;

      const offset = (page - 1) * pageSize;
      const dataParams = [...params, pageSize, offset];

      connection.query(dataSQL, dataParams, (err, list) => {
        if (err) return reject(err);
        resolve({ list, total });
      });
    });
  });
};

/**
 * 新建用户
 * @param {object} param - { username, phone, homeAddress, workLocation }
 */
const insertUser = ({ username, phone, homeAddress, workLocation }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "INSERT INTO `user` (username, phone, home_address, work_location) VALUES (?, ?, ?, ?)",
      [username, phone, homeAddress || null, workLocation || null],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 编辑用户
 * @param {number} id
 * @param {object} param - { username, phone, homeAddress, workLocation }
 */
const updateUser = (id, { username, phone, homeAddress, workLocation }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "UPDATE `user` SET username = ?, phone = ?, home_address = ?, work_location = ? WHERE id = ?",
      [username, phone, homeAddress || null, workLocation || null, id],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 删除用户
 * @param {number} id
 */
const deleteUser = (id) => {
  return new Promise((resolve, reject) => {
    connection.query("DELETE FROM `user` WHERE id = ?", [id], (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
};

//导出方法，在需要使用到的模块中导入
module.exports = {
  getAccount,
  insertAccount,
  updateAccount,
  deleteAccount,
  getUserList,
  insertUser,
  updateUser,
  deleteUser,
}
