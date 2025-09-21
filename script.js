const SCHEDULE_URL = './schedule_rfr.json';

function parseSchedule(raw) {
  // Find the most recent Monday
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  // Go back to the most recent Monday (0 = Sunday, 1 = Monday, etc)
  while (monday.getUTCDay() !== 1) {
    monday.setUTCDate(monday.getUTCDate() - 1);
  }
  
  let current = new Date(monday);
  // End time is the following Sunday at midnight
  const endTime = new Date(monday);
  endTime.setUTCDate(endTime.getUTCDate() + 7); // Add 7 days to get to next Monday
  
  let schedule = [];
  let idx = 1;
  let rawIndex = 0;
  
  while (current < endTime) {
    const item = raw[rawIndex];
    const entry = {
      idx: idx++,
      url: item.url,
      title: item.title || '',
      start: new Date(current),
      duration: (typeof item.duration === 'number' && isFinite(item.duration)) ? item.duration : null,
      airDate: item.airDate || '-',
      image: item.image || ''
    };
    
    schedule.unshift(entry);
    
    if (entry.duration) {
      current = new Date(current.getTime() + entry.duration * 1000);
    } else {
      // If no duration, assume 30 minutes
      current = new Date(current.getTime() + 30 * 60 * 1000);
    }
    
    // Loop back to the beginning of the raw list when we reach the end
    rawIndex = (rawIndex + 1) % raw.length;
  }
  console.log(schedule);
  return schedule;
}

function formatUTC(d){
  // Display as local date and time in a human-friendly way, 12-hour format
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return d.toLocaleString(undefined, {
    weekday: 'short',
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
  if (typeof seconds !== 'number' || !isFinite(seconds)) return '00:00:00';
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

const statusEl = document.getElementById('status');
const mediaContainer = document.getElementById('mediaContainer');
const muteButton = document.getElementById('muteButton');
const mobileMuteButton = document.getElementById('mobileMuteButton');
const mobileTitle = document.getElementById('mobileTitle');
const mobileAirDate = document.getElementById('mobileAirDate');
const mobileNextTitle = document.getElementById('mobileNextTitle');
const mobileNextAirDate = document.getElementById('mobileNextAirDate');
const progressBar = document.getElementById('progressBar');
const mobileTime = document.getElementById('mobileTime');
const desktopProgressBar = document.getElementById('desktopProgressBar');
const desktopTime = document.getElementById('desktopTime');

let schedule = [], currentItem = null, player = null;

// Update status element
function updateStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// Handle mute button clicks for both desktop and mobile
function handleMuteClick() {
  if (player) {
    player.muted = !player.muted;
    const newHTML = player.muted ? 
      '<i class="fas fa-volume-mute"></i><span>Unmute</span>' : 
      '<i class="fas fa-volume-up"></i><span>Mute</span>';
    muteButton.innerHTML = newHTML;
    mobileMuteButton.innerHTML = newHTML;
  }
}

muteButton.addEventListener('click', handleMuteClick);
mobileMuteButton.addEventListener('click', handleMuteClick);

// Update view info for both mobile and desktop
function updateViewInfo() {
  if (currentItem) {
    // Update mobile view
    mobileTitle.textContent = currentItem.title || currentItem.url;
    mobileAirDate.textContent = `Original Air Date: ${currentItem.airDate}`;
    
    // Update desktop view
    const desktopTitle = document.getElementById('desktopTitle');
    const desktopAirDate = document.getElementById('desktopAirDate');
    if (desktopTitle && desktopAirDate) {
      desktopTitle.textContent = currentItem.title || currentItem.url;
      desktopAirDate.textContent = `Original Air Date: ${currentItem.airDate}`;
    }
    
    // Update cover art for both views
    const mobileCoverArt = document.getElementById('mobileCoverArt');
    const desktopCoverArt = document.getElementById('desktopCoverArt');
    
    if (currentItem.image) {
      if (mobileCoverArt) {
        mobileCoverArt.src = currentItem.image;
        mobileCoverArt.style.display = 'block';
        mobileCoverArt.parentElement.style.display = 'block';
      }
      if (desktopCoverArt) {
        desktopCoverArt.src = currentItem.image;
      }
    } else {
      if (mobileCoverArt) {
        mobileCoverArt.style.display = 'none';
        mobileCoverArt.parentElement.style.display = 'none';
      }
      if (desktopCoverArt) {
        desktopCoverArt.style.display = 'none';
      }
    }
    
    // Find next item
    const currentIndex = schedule.findIndex(item => item.idx === currentItem.idx);
    if (currentIndex > -1 && currentIndex < schedule.length - 1) {
      const nextItem = schedule[currentIndex + 1];
      // Update mobile next
      mobileNextTitle.textContent = nextItem.title || nextItem.url;
      mobileNextAirDate.textContent = `Original Air Date: ${nextItem.airDate}`;
      // Update desktop next
      const desktopNextTitle = document.getElementById('desktopNextTitle');
      const desktopNextAirDate = document.getElementById('desktopNextAirDate');
      if (desktopNextTitle && desktopNextAirDate) {
        desktopNextTitle.textContent = nextItem.title || nextItem.url;
        desktopNextAirDate.textContent = `Original Air Date: ${nextItem.airDate}`;
      }
    }
  }
}

function updatePlaybackStatus(smooth = true) {
  tableBody.innerHTML = '';
  schedule.forEach(item=>{
    const tr = document.createElement('tr');
    tr.id = `row-${item.idx}`;
    tr.innerHTML = `<td>${item.idx}</td><td>${formatUTC(item.start)}</td><td>${item.title || item.url}</td><td>${item.airDate}</td><td id="st-${item.idx}">-</td>`;
    
    // If we have a current item, hide past episodes in desktop view
    if (currentItem && item.idx < currentItem.idx) {
      tr.classList.add('past-episode');
    }
    
    tableBody.appendChild(tr);
  });
}

// Helper function to scroll to current episode
function scrollToCurrentEpisode(smooth = true) {
  if (!currentItem) return;
  
  const row = document.getElementById(`row-${currentItem.idx}`);
  if (!row) return;

  // Only auto-scroll in desktop view
  if (window.innerWidth > 768) {
    const header = document.querySelector('.header-container');
    const controls = document.querySelector('.controls.desktop-controls');
    const offset = header.offsetHeight + controls.offsetHeight;

    const scrollOptions = {
      behavior: smooth ? 'smooth' : 'auto',
      block: 'nearest',
    };

    // Calculate the target scroll position
    const rowRect = row.getBoundingClientRect();
    const targetScroll = window.scrollY + rowRect.top - offset - 20; // 20px padding

    window.scrollTo({
      top: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
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
  await handlePlaybackAtLoad();
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

  // Update the view with current track info
  updateViewInfo();
  
  const ext = currentItem.url.split('.').pop().toLowerCase();
  const playerContainer = document.createElement('div');
  playerContainer.className = 'custom-player';

  if(['mp4','webm','ogg'].includes(ext)){
    player = document.createElement('video');
    player.width = 640; player.height = 360;
  } else {
    player = document.createElement('audio');
  }

  // Remove default controls and add custom player UI
  player.preload = 'metadata';
  player.src = currentItem.url;
  
  // Update status and progress when playing
  player.addEventListener('timeupdate', () => {
    if (currentItem && !player.paused) {
      const currentTime = formatDuration(Math.floor(player.currentTime));
      updateViewInfo();
      
      // Update progress bars
      if (player.duration) {
        const progress = (player.currentTime / player.duration) * 100;
        // Update mobile progress
        progressBar.style.width = `${progress}%`;
        mobileTime.textContent = currentTime;
        // Update desktop progress
        desktopProgressBar.style.width = `${progress}%`;
        desktopTime.textContent = currentTime;
      }
    }
  });


  
  updateViewInfo();
  player.addEventListener('play', updateViewInfo);

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
    if(idx >= 0 && idx < schedule.length - 1) {
      currentItem = schedule[idx + 1];
      updateViewInfo();
      // Play next from beginning
      statusEl.textContent = `Preparing '${currentItem.url}' — scheduled ${formatUTC(currentItem.start)}`;
      mediaContainer.innerHTML = '';
      // Always start at beginning for next track
      handlePlaybackAtLoad(0);
    } else {
      statusEl.textContent = 'End of schedule.';
      playToggle.textContent = 'Play';
    }
  });

  try {
    await player.play();
    updateStatus(`${currentItem.title || currentItem.url}`);
    updateViewInfo();
  } catch {
    updateStatus('Click Play to start');
    updateViewInfo();
    // Show the autoplay modal
    document.getElementById('autoplayModal').style.display = 'flex';
  }
}

// Modal play button handler
document.getElementById('modalPlayBtn').addEventListener('click', async () => {
  if (player && player.paused) {
    try {
      await player.play();
      updateStatus(`Playing: ${currentItem.title || currentItem.url}`);
      updateViewInfo();
      document.getElementById('autoplayModal').style.display = 'none';
    } catch (err) {
      updateStatus('Failed to start playback');
    }
  }
});

tryLoadSchedule();
