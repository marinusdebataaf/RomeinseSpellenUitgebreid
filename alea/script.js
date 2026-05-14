document.addEventListener('DOMContentLoaded', () => {
  const tableScene = document.getElementById('tableScene');
  const rollBtn = document.getElementById('rollBtn');
  const resetBtn = document.getElementById('resetBtn');
  const towerTrigger = document.getElementById('towerTrigger');
  const resultSummary = document.getElementById('resultSummary');
  const totalValue = document.getElementById('totalValue');
  const dieSlots = Array.from(document.querySelectorAll('.die-slot'));
  const topDieButtons = Array.from(document.querySelectorAll('.top-die-button'));

  if (
    !tableScene ||
    !rollBtn ||
    !resetBtn ||
    !towerTrigger ||
    !resultSummary ||
    !totalValue ||
    dieSlots.length !== 5 ||
    topDieButtons.length !== 5
  ) {
    console.error('Missing required dice game elements.');
    return;
  }

  let rolling = false;
  let activeDice = [true, true, true, true, true];
  let lastValues = [null, null, null, null, null];

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function updateTopDiceVisuals() {
    topDieButtons.forEach((button, index) => {
      const viewer = button.querySelector('model-viewer');
      const isActive = activeDice[index];

      button.classList.toggle('active', isActive);
      button.classList.toggle('kept', !isActive);
      button.setAttribute('aria-pressed', String(!isActive));

      if (viewer) {
        if (isActive) {
          viewer.setAttribute('auto-rotate', '');
        } else {
          viewer.removeAttribute('auto-rotate');
        }
      }
    });
  }

  function getRollingIndexes() {
    return activeDice
      .map((isActive, index) => (isActive ? index : -1))
      .filter(index => index !== -1);
  }

  function updateSummaryFromLastValues() {
    const shown = lastValues.filter(value => value !== null);
    const total = shown.reduce((sum, value) => sum + value, 0);

    resultSummary.textContent = shown.length ? shown.join(' - ') : 'Nog niet gegooid';
    totalValue.textContent = shown.length ? String(total) : '0';
  }

  function hideResults() {
    dieSlots.forEach((slot) => {
      slot.classList.remove('visible', 'launching');
      slot.style.opacity = '0';
    });
  }

  function resetDieImages() {
    dieSlots.forEach((slot, index) => {
      const img = slot.querySelector('.result-die');
      if (img) {
        img.src = `dice${(index % 5) + 1}.png`;
        img.style.transform = 'translate(-50%, 0) rotate(0deg)';
      }
    });
  }

  function randomizeDicePositions(indexesToPlace) {
    const isPhone = window.innerWidth <= 640;
    const placed = [];
    const minDistance = isPhone ? 20 : 16;

    const bounds = isPhone
      ? { leftMin: 18, leftMax: 82, bottomMin: 10, bottomMax: 42 }
      : { leftMin: 18, leftMax: 78, bottomMin: 12, bottomMax: 40 };

    indexesToPlace.forEach((slotIndex) => {
      const slot = dieSlots[slotIndex];
      let tries = 0;
      let pos;

      do {
        pos = {
          left: randomInt(bounds.leftMin, bounds.leftMax),
          bottom: randomInt(bounds.bottomMin, bounds.bottomMax)
        };
        tries++;
        if (tries > 100) break;
      } while (
        placed.some((p) => {
          const dx = p.left - pos.left;
          const dy = p.bottom - pos.bottom;
          return Math.sqrt(dx * dx + dy * dy) < minDistance;
        })
      );

      placed.push(pos);

      const img = slot.querySelector('.result-die');
      const rot = randomInt(-18, 18);

      slot.style.left = `${pos.left}%`;
      slot.style.bottom = `${pos.bottom}%`;

      if (img) {
        img.style.transform = `translate(-50%, 0) rotate(${rot}deg)`;
      }
    });
  }

  function launchDiceFromTower(rollingIndexes) {
    randomizeDicePositions(rollingIndexes);

    rollingIndexes.forEach((slotIndex, sequenceIndex) => {
      const slot = dieSlots[slotIndex];
      const img = slot.querySelector('.result-die');
      const value = lastValues[slotIndex];

      if (img && value !== null) {
        img.src = `dice${value}.png`;
      }

      slot.classList.remove('visible', 'launching');
      slot.style.opacity = '0';
      slot.style.transform = 'translate(-50%, -180px) scale(0.45)';

      setTimeout(() => {
        slot.classList.add('launching');
      }, 60 * sequenceIndex);

      setTimeout(() => {
        slot.classList.remove('launching');
        slot.classList.add('visible');
        slot.style.opacity = '1';
        slot.style.transform = 'translate(-50%, 0) scale(1)';
      }, 220 + (90 * sequenceIndex));
    });
  }

  function rollDice() {
    if (rolling) return;

    const rollingIndexes = getRollingIndexes();

    if (rollingIndexes.length === 0) {
      resultSummary.textContent = 'Geen actieve dobbelstenen';
      totalValue.textContent = '0';
      return;
    }

    rolling = true;
    tableScene.classList.add('rolling');

    const rollingSet = new Set(rollingIndexes);

    dieSlots.forEach((slot, index) => {
      if (rollingSet.has(index)) {
        slot.classList.remove('visible', 'launching');
        slot.style.opacity = '0';
      } else {
        slot.classList.remove('visible', 'launching');
        slot.style.opacity = '0';
        lastValues[index] = null;
      }
    });

    resultSummary.textContent = 'Dobbelstenen rollen...';
    totalValue.textContent = '...';

    rollingIndexes.forEach((slotIndex) => {
      lastValues[slotIndex] = randomInt(1, 6);
    });

    setTimeout(() => {
      tableScene.classList.remove('rolling');
      launchDiceFromTower(rollingIndexes);
      updateSummaryFromLastValues();
      rolling = false;
    }, 950);
  }

  function toggleTopDie(index) {
    if (rolling) return;

    activeDice[index] = !activeDice[index];
    updateTopDiceVisuals();
  }

  function resetGame() {
    rolling = false;
    tableScene.classList.remove('rolling');

    activeDice = [true, true, true, true, true];
    lastValues = [null, null, null, null, null];

    resetDieImages();
    hideResults();
    updateTopDiceVisuals();
    updateSummaryFromLastValues();
  }

  topDieButtons.forEach((button, index) => {
    button.addEventListener('click', () => toggleTopDie(index));
  });

  towerTrigger.addEventListener('click', rollDice);
  rollBtn.addEventListener('click', rollDice);
  resetBtn.addEventListener('click', resetGame);

  resetGame();
});
