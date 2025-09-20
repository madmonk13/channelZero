// Media Player Manager
class MediaPlayerManager {
  constructor() {
    this.SCHEDULE_URL = './schedule.json';
    this.schedule = [];
    this.currentItem = null;
    this.player = null;
    
    // Initialize DOM elements
    this.elements = {
      status: document.getElementById('status'),
      tableBody: document.querySelector('#schedTable tbody'),
      mediaContainer: document.getElementById('mediaContainer'),
      muteButton: document.getElementById('muteButton'),
      mobileMuteButton: document.getElementById('mobileMuteButton'),
      mobileTitle: document.getElementById('mobileTitle'),
      mobileAirDate: document.getElementById('mobileAirDate'),
      mobileNextTitle: document.getElementById('mobileNextTitle'),
      mobileNextAirDate: document.getElementById('mobileNextAirDate'),
      progressBar: document.getElementById('progressBar'),
      mobileTime: document.getElementById('mobileTime'),
      desktopProgressBar: document.getElementById('desktopProgressBar'),
      desktopTime: document.getElementById('desktopTime'),
      autoplayModal: document.getElementById('autoplayModal'),
      modalPlayBtn: document.getElementById('modalPlayBtn'),
      loadingModal: document.getElementById('loadingModal')
    };

    // Bind event handlers
    this.handleMute = this.handleMute.bind(this);
    this.handleModalPlay = this.handleModalPlay.bind(this);

    this.elements.muteButton.addEventListener('click', this.handleMute);
    this.elements.mobileMuteButton.addEventListener('click', this.handleMute);
    this.elements.modalPlayBtn.addEventListener('click', this.handleModalPlay);
    this.elements.modalPlayBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.currentTarget.click();
    });
  }

  formatAirDate(dateString) {
    const date = new Date(dateString);
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'UTC'
    };
    return date.toLocaleDateString(undefined, options);
  }

  formatUTC(date) {
    return date.toLocaleString(undefined, {
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

  formatDuration(seconds) {
    if (typeof seconds !== 'number' || !isFinite(seconds)) return '00:00:00';
    seconds = Math.floor(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  updateStatus(text, airDate) {
    if (this.elements.status) {
      if (airDate) {
        const formattedDate = this.formatAirDate(airDate);
        this.elements.status.textContent = `${text} (Original Air Date: ${formattedDate})`;
      } else {
        this.elements.status.textContent = text;
      }
    }
  }

  setItemStatus(item, text) {
    const el = document.getElementById(`st-${item.idx}`);
    if (el) el.textContent = text;
  }

  showLoadingModal() {
    this.elements.loadingModal.style.display = 'flex';
  }

  hideLoadingModal() {
    this.elements.loadingModal.style.display = 'none';
  }

  parseSchedule(raw) {
    const now = new Date();
    const monday = new Date(now);
    monday.setUTCHours(0, 0, 0, 0);
    
    while (monday.getUTCDay() !== 1) {
      monday.setUTCDate(monday.getUTCDate() - 1);
    }

    const firstDayOfMonth = new Date(monday);
    firstDayOfMonth.setUTCDate(1);
    
    while (firstDayOfMonth.getUTCDay() !== 1) {
      firstDayOfMonth.setUTCDate(firstDayOfMonth.getUTCDate() + 1);
    }
    
    const weekOfMonth = Math.ceil((monday.getUTCDate() - firstDayOfMonth.getUTCDate()) / 7) + 1;
    const lastDayOfMonth = new Date(monday);
    lastDayOfMonth.setUTCMonth(lastDayOfMonth.getUTCMonth() + 1, 0);
    const totalWeeks = Math.ceil((lastDayOfMonth.getUTCDate() - firstDayOfMonth.getUTCDate() + 1) / 7);
    
    const totalEpisodes = raw.length;
    const episodesPerWeek = Math.floor(totalEpisodes / totalWeeks);
    const weekOffset = (weekOfMonth - 1) * episodesPerWeek;
    
    let current = new Date(monday);
    const endTime = new Date(monday);
    endTime.setUTCDate(endTime.getUTCDate() + 7);
    
    const schedule = [];
    let idx = 1;
    let rawIndex = weekOffset % raw.length;
    
    while (current < endTime) {
      const item = raw[rawIndex];
      const entry = {
        idx: idx++,
        url: item.url,
        title: item.title || '',
        start: new Date(current),
        duration: (typeof item.duration === 'number' && isFinite(item.duration)) ? item.duration : null,
        airDate: item.airDate || '-'
      };
      
      schedule.push(entry);
      
      if (entry.duration) {
        current = new Date(current.getTime() + entry.duration * 1000);
      } else {
        current = new Date(current.getTime() + 30 * 60 * 1000);
      }
      
      rawIndex = (rawIndex + 1) % raw.length;
    }
    
    return schedule;
  }

  findCurrent(now = new Date()) {
    for (const it of this.schedule) {
      if (it.duration != null) {
        const end = new Date(it.start.getTime() + it.duration * 1000);
        if (now >= it.start && now < end) {
          return { item: it, elapsed: (now - it.start) / 1000 };
        }
      }
    }
    
    const candidates = this.schedule.filter(it => now >= it.start && it.duration == null);
    if (candidates.length) {
      const it = candidates[candidates.length - 1];
      return { item: it, elapsed: (now - it.start) / 1000 };
    }
    return null;
  }

  renderTable() {
    this.elements.tableBody.innerHTML = '';
    const visibleEpisodes = this.getVisibleEpisodes();
    
    visibleEpisodes.forEach(item => {
      const tr = document.createElement('tr');
      tr.id = `row-${item.idx}`;
      tr.innerHTML = `
        <td>${item.idx}</td>
        <td>${this.formatUTC(item.start)}</td>
        <td>${item.title || item.url}</td>
        <td>${this.formatAirDate(item.airDate)}</td>
        <td id="st-${item.idx}">-</td>
      `;
      
      if (this.currentItem && item.idx < this.currentItem.idx) {
        tr.classList.add('past-episode');
      }
      
      this.elements.tableBody.appendChild(tr);
    });
  }

  getVisibleEpisodes() {
    if (!this.currentItem || !this.schedule.length) return this.schedule;
    
    const currentIndex = this.schedule.findIndex(item => item.idx === this.currentItem.idx);
    if (currentIndex === -1) return this.schedule;

    const startIndex = Math.max(0, currentIndex - 1);
    const endIndex = Math.min(this.schedule.length, currentIndex + 9);
    return this.schedule.slice(startIndex, endIndex);
  }

  handleMute() {
    if (this.player) {
      this.player.muted = !this.player.muted;
      const newHTML = this.player.muted ? 
        '<i class="fas fa-volume-mute"></i><span>Unmute</span>' : 
        '<i class="fas fa-volume-up"></i><span>Mute</span>';
      this.elements.muteButton.innerHTML = newHTML;
      this.elements.mobileMuteButton.innerHTML = newHTML;
    }
  }

  async handleModalPlay() {
    if (!this.player) return;
    
    try {
      if (this.player.readyState === 0) {
        await new Promise((resolve, reject) => {
          const loadTimeout = setTimeout(() => {
            reject(new Error('Media loading timed out'));
          }, 30000);

          const cleanup = () => {
            this.player.removeEventListener('loadedmetadata', handleLoad);
            this.player.removeEventListener('error', handleError);
            clearTimeout(loadTimeout);
          };

          const handleLoad = () => {
            cleanup();
            resolve();
          };

          const handleError = (error) => {
            cleanup();
            reject(error);
          };

          this.player.addEventListener('loadedmetadata', handleLoad);
          this.player.addEventListener('error', handleError);
          this.player.load();
        });
      }

      await this.player.play();
      this.updateStatus(`Playing: ${this.currentItem.title || this.currentItem.url}`, this.currentItem.airDate);
      this.setItemStatus(this.currentItem, `Playing (${this.formatDuration(this.player.currentTime)})`);
      this.elements.autoplayModal.style.display = 'none';
    } catch (err) {
      console.error('Playback failed:', err);
      let message = 'Failed to start playback';
      
      if (err.name === 'NotSupportedError') {
        message = 'Media format not supported by your browser';
      } else if (err.name === 'NotAllowedError') {
        message = 'Playback not allowed. Please try again.';
      } else if (err.message === 'Media loading timed out') {
        message = 'Media loading timed out. Please check your connection and try again.';
      }
      
      this.updateStatus(`Error: ${message}`);
    }
  }

  async initializePlayer(item) {
    try {
      if (this.player) {
        try {
          this.player.pause();
          this.player.remove();
        } catch (err) {
          console.warn('Error cleaning up old player:', err);
        }
        this.player = null;
      }

      const ext = item.url.split('.').pop().toLowerCase();
      const isVideo = ['mp4','webm','ogg'].includes(ext);
      
      this.player = document.createElement(isVideo ? 'video' : 'audio');
      if (isVideo) {
        this.player.width = 640;
        this.player.height = 360;
      }
      
      this.setupPlayerEventHandlers();
      
      this.player.preload = 'auto';
      this.player.crossOrigin = 'anonymous';
      
      // Set source and type
      this.player.src = item.url;
      this.player.type = isVideo ? `video/${ext}` : 'audio/mpeg';
      
      this.elements.mediaContainer.appendChild(this.player);
      
      try {
        await this.player.play();
        this.updateStatus(`${item.title || item.url}`, item.airDate);
        this.setItemStatus(item, `Playing (${this.formatDuration(0)})`);
      } catch (err) {
        this.updateStatus('Click Play to start');
        this.setItemStatus(item, 'Waiting');
        this.elements.autoplayModal.style.display = 'flex';
      }
    } catch (err) {
      console.error('Error initializing player:', err);
      this.updateStatus('Error initializing media player');
    }
  }

  setupPlayerEventHandlers() {
    this.player.onerror = (e) => {
      console.error('Media Error Event:', e);
      if (this.player.error) {
        console.error('Player Error:', {
          code: this.player.error.code,
          message: this.player.error.message
        });
        
        let errorMessage = 'Unable to play media. ';
        switch (this.player.error.code) {
          case 1: errorMessage += 'The media was aborted.'; break;
          case 2: errorMessage += 'Network error occurred.'; break;
          case 3: errorMessage += 'Media decoding failed.'; break;
          case 4: errorMessage += 'Media source not supported.'; break;
          default: errorMessage += this.player.error.message || 'Unknown error occurred.';
        }
        this.updateStatus(errorMessage);
      }
    };

    this.player.addEventListener('timeupdate', () => {
      if (this.currentItem && !this.player.paused) {
        const currentTime = this.formatDuration(Math.floor(this.player.currentTime));
        this.setItemStatus(this.currentItem, `Playing (${currentTime})`);
        
        if (this.player.duration) {
          const progress = (this.player.currentTime / this.player.duration) * 100;
          this.elements.progressBar.style.width = `${progress}%`;
          this.elements.mobileTime.textContent = currentTime;
          this.elements.desktopProgressBar.style.width = `${progress}%`;
          this.elements.desktopTime.textContent = currentTime;
        }
      }
    });

    this.player.addEventListener('ended', () => {
      const idx = this.schedule.findIndex(it => it.idx === this.currentItem.idx);
      if (idx >= 0 && idx < this.schedule.length - 1) {
        this.currentItem = this.schedule[idx + 1];
        this.initializePlayer(this.currentItem);
      } else {
        this.updateStatus('End of schedule.');
      }
    });
  }

  async loadSchedule() {
    try {
      this.updateStatus('Loading schedule...');
      const res = await fetch(this.SCHEDULE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch schedule');
      
      const data = await res.json();
      this.schedule = this.parseSchedule(data);
      this.updateStatus('Schedule loaded');
      this.renderTable();
      
      const current = this.findCurrent();
      if (current) {
        this.currentItem = current.item;
        await this.initializePlayer(this.currentItem);
      } else {
        this.updateStatus('No scheduled media for right now.');
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
      this.updateStatus('Failed to load schedule');
    }
  }
}

// Initialize the application
const player = new MediaPlayerManager();
player.loadSchedule().catch(err => {
  console.error('Failed to start application:', err);
});
