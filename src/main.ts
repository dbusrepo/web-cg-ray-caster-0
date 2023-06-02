import './css/app.css';
import { App } from './app/app';

window.onload = async () => {
  // console.log("isolated:" + self.crossOriginIsolated);
  const app = new App();
  await app.init();
  app.run();
};
