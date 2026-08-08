module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // unstable_transformImportMeta: zustand использует import.meta,
      // который Metro на вебе не поддерживает — полифилл чинит веб-версию
      ['babel-preset-expo', { unstable_transformImportMeta: true }],
    ],
  };
};
