const SCHEDULE_URL = './schedule.json';

function parseSchedule(raw) {
  // Generate schedule with start times based on durations, starting at midnight
  const midnight = new Date();
  midnight.setUTCHours(0,0,0,0);
  let current = new Date(midnight);
  return raw.map((it, i) => {
    const entry = {
      idx: i+1,
      url: it.url,
      title: it.title || '',
      start: new Date(current),
      duration: (typeof it.duration === 'number' && isFinite(it.duration)) ? it.duration : null,
      airDate: it.airDate || '-'
    };
    if (entry.duration) {
      current = new Date(current.getTime() + entry.duration * 1000);
    }
    return entry;
  });
}

function formatUTC(d){
  // Display as local date and time in a human-friendly way, 12-hour format
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds)) return '-';
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

const statusEl = document.getElementById('status');
const tableBody = document.querySelector('#schedTable tbody');
const playToggle = document.getElementById('playToggle');
const mediaContainer = document.getElementById('mediaContainer');

let schedule = [], currentItem = null, player = null;

function renderTable() {
  tableBody.innerHTML = '';
  schedule.forEach(item=>{
    const tr = document.createElement('tr');
    tr.id = `row-${item.idx}`;
    tr.innerHTML = `<td>${item.idx}</td><td>${formatUTC(item.start)}</td><td>${item.title || item.url}</td><td>${item.airDate}</td><td>${formatDuration(item.duration)}</td><td id="st-${item.idx}">-</td>`;
    tableBody.appendChild(tr);
  });
}

function findCurrent(now = new Date()){
  for(const it of schedule){
    if(it.duration!=null){
      const end = new Date(it.start.getTime() + it.duration*1000);
      if(now >= it.start && now < end) return {item:it, elapsed: (now - it.start)/1000};
    }
  }
  const candidates = schedule.filter(it => now >= it.start && it.duration==null);
  if(candidates.length) {
    const it = candidates[candidates.length-1];
    return {item:it, elapsed: (now - it.start)/1000};
  }
  return null;
}

async function tryLoadSchedule(){
  statusEl.textContent = 'Loading schedule...';
  try{
    const res = await fetch(SCHEDULE_URL, {cache:'no-store'});
    if(!res.ok) throw new Error();
    schedule = parseSchedule(await res.json());
    statusEl.textContent = 'Loaded external schedule.json';
  }catch{
    schedule = [];
    statusEl.textContent = 'Failed to load schedule.json';
  }
  renderTable();
  await handlePlaybackAtLoad();
}

function setItemStatus(item, text){
  const el = document.getElementById('st-' + item.idx);
  if(el) el.textContent = text;
}

function showLoadingModal() {
  document.getElementById('loadingModal').style.display = 'flex';
}

function hideLoadingModal() {
  document.getElementById('loadingModal').style.display = 'none';
}

async function handlePlaybackAtLoad(seekTo = null){
  const now = new Date();
  const found = findCurrent(now);
  schedule.forEach(it=>setItemStatus(it,'-'));
  mediaContainer.innerHTML = '';

  if(!found){
    statusEl.textContent = 'No scheduled media for right now.';
    currentItem = null;
    return;
  }

  currentItem = found.item;
  let elapsed = found.elapsed;
  if (seekTo !== null) elapsed = seekTo;
  statusEl.textContent = `Preparing '${currentItem.url}' — scheduled ${formatUTC(currentItem.start)}`;
  setItemStatus(currentItem,'Playing');

  // Scroll to the currently playing row in the table
    setTimeout(() => {
      const row = document.getElementById(`row-${currentItem.idx}`);
      if(row) {
        // Add highlight class first
        row.classList.add('highlight-current');
        
        // On mobile, account for sticky header and controls
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          const headerHeight = document.querySelector('.header-container').offsetHeight;
          const controlsHeight = document.querySelector('.controls').offsetHeight;
          const totalOffset = headerHeight + controlsHeight + 20; // Add some padding
          
          const rowRect = row.getBoundingClientRect();
          window.scrollTo({
            top: window.scrollY + rowRect.top - totalOffset,
            behavior: 'smooth'
          });
        } else {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);  const ext = currentItem.url.split('.').pop().toLowerCase();
  if(['mp4','webm','ogg'].includes(ext)){
    player = document.createElement('video');
    player.width = 640; player.height = 360; player.controls = true;
  } else {
    player = document.createElement('audio');
    player.controls = true;
  }

  player.preload = 'metadata';
  player.src = currentItem.url;
  mediaContainer.appendChild(player);

  showLoadingModal();
  
  await new Promise(resolve=>{
    const loadTimeout = setTimeout(() => {
      hideLoadingModal();
      resolve();
    }, 30000); // Timeout after 30 seconds
    
    player.addEventListener('loadedmetadata', ()=>{
      clearTimeout(loadTimeout);
      hideLoadingModal();
      let seek = elapsed;
      const dur = currentItem.duration ?? player.duration;
      if(dur && seek >= dur) seek = Math.max(0, dur - 0.5);
      try{player.currentTime = Math.max(0, seek);}catch{}
      resolve();
    });
    
    player.addEventListener('error', () => {
      clearTimeout(loadTimeout);
      hideLoadingModal();
      resolve();
    });
    
    player.load();
  });

  // Auto-advance to next file when current ends
  player.addEventListener('ended', () => {
    const idx = schedule.findIndex(it => it.idx === currentItem.idx);
    // Remove highlight from previous row
    if(currentItem && currentItem.idx) {
      const prevRow = document.getElementById(`row-${currentItem.idx}`);
      if(prevRow) prevRow.classList.remove('highlight-current');
    }
    if(idx >= 0 && idx < schedule.length - 1) {
      currentItem = schedule[idx + 1];
      // Scroll to next and play
      setTimeout(() => {
        const row = document.getElementById(`row-${currentItem.idx}`);
        if(row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('highlight-current');
        }
      }, 100);
      // Play next from beginning
      statusEl.textContent = `Preparing '${currentItem.url}' — scheduled ${formatUTC(currentItem.start)}`;
      setItemStatus(currentItem,'Loading');
      mediaContainer.innerHTML = '';
      // Always start at beginning for next track
      handlePlaybackAtLoad(0);
    } else {
      statusEl.textContent = 'End of schedule.';
      playToggle.textContent = 'Play';
    }
  });

  try{
    await player.play();
    playToggle.textContent = 'Pause';
    statusEl.textContent = `Playing: ${currentItem.title || currentItem.url}`;
    setItemStatus(currentItem,'Playing');
  }catch{
    statusEl.textContent = 'Autoplay blocked — click Play to start.';
    setItemStatus(currentItem,'Playing');
    playToggle.textContent = 'Play';
    // Show modal
    document.getElementById('autoplayModal').style.display = 'flex';
  }
}

playToggle.addEventListener('click', async ()=>{
  if(!player){statusEl.textContent = 'No media loaded.';return;}
  if(player.paused){
    await player.play();
    playToggle.textContent = 'Pause';
    statusEl.textContent = 'Playing';
    document.getElementById('autoplayModal').style.display = 'none';
  }
  else {
    player.pause();
    playToggle.textContent = 'Play';
    statusEl.textContent = 'Paused';
  }
});

// Modal play button handler
document.getElementById('modalPlayBtn').addEventListener('click', async ()=>{
  if(player && player.paused){
    await player.play();
    playToggle.textContent = 'Pause';
    statusEl.textContent = 'Playing';
    document.getElementById('autoplayModal').style.display = 'none';
  }
});

tryLoadSchedule();
