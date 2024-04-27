import { Retrier } from '@jsier/retrier';

async function requestPointerLockWithoutUnadjustedMovement(element) {
  const promise = element.requestPointerLock({
    unadjustedMovement: false,
  });

  if (!promise) return; // no promise version

  try {
    await promise;
    // console.log('pointer is locked without unadjusted movement');
  } catch (error) {
    console.log(
      `pointer can't be locked without unadjusted movement: "${error.message}"`,
    );
    if (error.name === 'SecurityError') {
      throw error;
    }
  }
}

async function requestPointerLockWithUnadjustedMovement(element) {
  const promise = element.requestPointerLock({
    unadjustedMovement: true,
  });

  if (!promise) return; // no promise version

  try {
    await promise;
    // console.log('pointer is locked with unadjusted movement');
  } catch (error) {
    console.log(
      `pointer can't be locked with unadjusted movement: "${error.message}"`,
    );
    if (error.name === 'NotSupportedError') {
      // Some platforms may not support unadjusted movement.
      // You can request again a regular pointer lock.
      await requestPointerLockWithoutUnadjustedMovement(element);
    }
    if (error.name === 'SecurityError') {
      throw error;
    }
  }
}

async function requestPointerLock(element) {
  const exec = () => requestPointerLockWithUnadjustedMovement(element);
  const options = { limit: 10, delay: 200, firstAttemptDelay: 0 };
  const retrier = new Retrier(options);
  return retrier.resolve(exec).then(
    (_res) => {}, // console.log('ALL OK: ', result),
    (error) => console.error(error), // After 5 attempts logs: "Rejected!"
  );
}

export { requestPointerLock };
