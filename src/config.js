module.exports = {
  groupUrl: 'https://www.douban.com/group/search?cat=1019&q=上海租房', // 默认检索第一页全部小组
  itemsToRead: 100, // 每个group要检索多少条帖子。大量访问，存在被禁 ip 风险。
  filters: {
    title: title => {
      return title.includes('一室');
    },
    author: author => {
      return true;
    },
    replay: replay => {
      return true;
    },
    lastReplay: lastReplay => {
      return true;
    }
  }
};
