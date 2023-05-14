// Do not modify. This file is auto generated from images.res with make
const getImagesPaths = async () => {
  const paths = [
    import('./pics/bluestone.png'),
    import('./pics/greystone.png'),
  ];
  return (await Promise.all(paths)).map((imp) => imp.default);
};

const images = {
  BLUESTONE: 'pics/bluestone.png',
  GREYSTONE: 'pics/greystone.png',
};

const ascImportImages = {
  BLUESTONE: 0,
  GREYSTONE: 1,
};

export { images, getImagesPaths, ascImportImages };
