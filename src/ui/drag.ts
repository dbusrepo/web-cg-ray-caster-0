const dragElement = (element: HTMLElement) => {
  let pX: number;
  let pY: number;

  const dragMouseUp = () => {
    document.onmouseup = null;
    document.onmousemove = null;
  };

  const dragMouseMove = (event: MouseEvent) => {
    event.preventDefault();

    // //clientX/Y property returns the horz/vert coordinate of the mouse pointer
    // const dx = event.clientX - pX;
    // const dy = event.clientY - pY;
    // pX = event.clientX;
    // pY = event.clientY;
    //
    // //offsetTop property returns the top position relative to the parent
    // const tx = element.offsetLeft + dx;
    // const ty = element.offsetTop + dy;
    //
    // element.style.top = `${ty}px`;
    // element.style.left = `${tx}px`;

    const parentEl = element.parentElement!;

    // https://stackoverflow.com/questions/52231588/how-to-constrain-div-drag-space-no-jquery
    let x = +(parseInt(element.style.left, 10) || 0) + event.movementX;
    let y = +(parseInt(element.style.top, 10) || 0) + event.movementY;

    const xp = +(parentEl.style.left.match(/-?\d+/g) || 0);
    const yp = +(parentEl.style.top.match(/-?\d+/g) || 0);
    const w = element.getBoundingClientRect().width;
    const h = element.getBoundingClientRect().height;
    const r = parentEl.getBoundingClientRect();
    const pw = r.width;
    const ph = r.height;
    // assert x,y and w,h inside parent?

    // if (x < 0 || y < 0 || x + w >= pw || y + h >= ph) {
    //   return;
    // }

    if (x < xp) {
      x = xp;
    }

    if (x + w >= xp + pw) {
      x = xp + pw - w;
    }

    if (y < yp) {
      y = yp;
    }

    if (y + h >= yp + ph) {
      y = yp + ph - h;
    }

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  const dragMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    pX = event.clientX;
    pY = event.clientY;

    document.onmouseup = dragMouseUp;
    document.onmousemove = dragMouseMove;
  };

  element.onmousedown = dragMouseDown;
};

export { dragElement };
