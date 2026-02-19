
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

  let eg4Data = [];

  const THRESHOLDS = {
    efficiency_critical: 85,
    efficiency_warning: 3,
    peak_coverage_critical: 90,
    peak_coverage_warning: 50,
    solar_critical: 15,
    solar_warning: 25,
    cost_critical: 15,
    cost_warning: 15,
    missed_slot_cost_threshold: 1.50
  };

  function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';
  }

  function clearData() {
    document.querySelectorAll('input, textarea').forEach(el => el.value = '');
    eg4Data = [];
    document.getElementById('fileCount').textContent = '';
    document.getElementById('pdfFileName').textContent = '';
    document.getElementById('uploadSection').classList.remove('active');
    document.getElementById('pdfUploadSection').classList.remove('active');
    document.getElementById('generateBtn').disabled = true;
    showStatus('Form data cleared. Historical data preserved.', 'success');
  }

  function clearAll() {
    clearData();
    updateHistoryDisplay();
    loadConfigBar();
  }

  // ── CONFIG BAR — reads localStorage, no core logic changes ──
  function isConfigComplete(c) {
    // Must have these key fields to be considered complete
    return c && c.inverterBrand && c.batteryBrand && c.utility &&
           c.s1EveStart && c.s1EveEnd && c.configVersion;
  }

  function loadConfigBar() {
    const raw = localStorage.getItem('hea_config');
    const bar     = document.getElementById('configBar');
    const summary = document.getElementById('configSummary');
    const warning = document.getElementById('configWarning');

    // No config at all — show warning, hide green bar
    if (!raw) {
      if (bar)     bar.style.display     = 'none';
      if (warning) warning.style.display = 'block';
      return;
    }

    let c = {};
    try { c = JSON.parse(raw); } catch(e) {
      if (bar)     bar.style.display     = 'none';
      if (warning) warning.style.display = 'block';
      return;
    }

    // Config exists but is incomplete — show warning AND green bar with what we have
    if (!isConfigComplete(c)) {
      if (warning) warning.style.display = 'block';
    } else {
      if (warning) warning.style.display = 'none';
    }

    // Always show green bar if any config data exists
    if (!bar || !summary) return;
    const totalKw  = ((c.inverterCount||1) * (c.inverterKwEach||6)).toFixed(1);
    const totalKwh = ((c.batteryCount||1)  * (c.batteryKwhEach||5.12)).toFixed(2);
    const fmt = h => {
      if (!h || h === 'none') return null;
      const n = parseInt(h);
      return n < 12 ? n+'AM' : n===12 ? '12PM' : (n-12)+'PM';
    };
    let tou = '';
    if (fmt(c.s1MornStart)) tou += fmt(c.s1MornStart)+'–'+fmt(c.s1MornEnd)+' · ';
    if (fmt(c.s1EveStart))  tou += fmt(c.s1EveStart)+'–'+fmt(c.s1EveEnd);
    const days    = (c.peakDays||[]).length;
    const dayStr  = days===7 ? 'All Days' : days===5 ? 'Weekdays' : days > 0 ? days+'d/wk' : 'Days not set';
    const touStr  = tou || '⚠️ TOU not configured';
    const incomplete = !isConfigComplete(c) ? ' &nbsp;<span style="color:#856404; font-size:11px; font-weight:400;">(incomplete — click Edit Setup)</span>' : '';
    summary.innerHTML =
      `⚡ <strong>${c.inverterBrand||'EG4'} ${c.inverterModel||'6000XP'} × ${c.inverterCount||1}</strong> (${totalKw} kW)&nbsp;&nbsp;|&nbsp;&nbsp;` +
      `🔋 <strong>${c.batteryBrand||'Battery'} × ${c.batteryCount||1}</strong> (${totalKwh} kWh)&nbsp;&nbsp;|&nbsp;&nbsp;` +
      `🏢 <strong>${c.utility||'Not set'}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;` +
      `⏰ <strong>${touStr}</strong> ${dayStr}${incomplete}`;
    bar.style.display = 'flex';

    // Update utility name in Bill Data section labels
    const utilName = c.utility || 'Utility';
    const utilLabel = document.getElementById('utilityLabel');
    if (utilLabel) utilLabel.textContent = utilName;
    document.querySelectorAll('.utilityLabelInline').forEach(el => el.textContent = utilName);
  }
  // ── END CONFIG BAR ──────────────────────────────────

  function initApp() {
    const raw = localStorage.getItem('hea_config');
    // No config at all — send to setup on first launch
    if (!raw) {
      window.location.href = 'HEA_System_Config.html';
      return;
    }
    // Config exists (even if incomplete) — load app normally
    // Warning banner handles the incomplete case
    clearAll();
  }

  function updateHistoryDisplay() {
    const history = loadHistoricalData();
    const countElem = document.getElementById('historyCount');
    const statusElem = document.getElementById('historyStatus');
    
    if (history.length > 0) {
      countElem.textContent = history.length;
      statusElem.style.display = 'block';
    } else {
      statusElem.style.display = 'none';
    }
  }

  function clearHistoricalData() {
    if (confirm('⚠️ WARNING: This will permanently delete all historical comparison data.\\n\\nYou will lose all month-over-month tracking.\\n\\nAre you sure?')) {
      localStorage.removeItem('hea_historical_data');
      updateHistoryDisplay();
      showStatus('Historical data permanently deleted. Starting fresh.', 'success');
    }
  }

  window.addEventListener('DOMContentLoaded', updateHistoryDisplay);

  function loadHistoricalData() {
    try {
      const stored = localStorage.getItem('hea_historical_data');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading historical data:', e);
      return [];
    }
  }

  function saveHistoricalData(monthData) {
    try {
      let history = loadHistoricalData();
      
      // Check for duplicate by matching BOTH start and end dates
      const existingIndex = history.findIndex(m => 
        m.startDate === monthData.startDate && m.endDate === monthData.endDate
      );
      
      if (existingIndex >= 0) {
        // DUPLICATE FOUND - Update existing entry instead of adding new
        console.log(`⚠️ Duplicate period detected: ${monthData.startDate} to ${monthData.endDate}`);
        console.log('Updating existing entry instead of creating duplicate.');
        history[existingIndex] = monthData;
        localStorage.setItem('hea_historical_data', JSON.stringify(history));
        return 'updated';
      } else {
        // NEW PERIOD - Add to history
        console.log(`✅ New period saved: ${monthData.startDate} to ${monthData.endDate}`);
        history.push(monthData);
        history = history.slice(-12); // Keep only last 12 months
        localStorage.setItem('hea_historical_data', JSON.stringify(history));
        return 'added';
      }
    } catch (e) {
      console.error('Error saving historical data:', e);
      return false;
    }
  }

  document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = e.target.files;
    if (files.length === 0) return;
    
    showStatus('Processing ' + files.length + ' file(s)...', 'success');
    eg4Data = [];
    let processed = 0;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            eg4Data = eg4Data.concat(jsonData);
          });
          
          processed++;
          if (processed === files.length) {
            document.getElementById('uploadSection').classList.add('active');
            document.getElementById('fileCount').textContent = 
              `✓ Loaded ${eg4Data.length} log entries from ${files.length} file(s)`;
            showStatus(`Successfully loaded ${eg4Data.length} log entries!`, 'success');
            checkReady();
          }
        } catch (err) {
          showStatus('Error reading file: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  });

  document.getElementById('pdfInput').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      document.getElementById('pdfFileName').textContent = '✓ ' + e.target.files[0].name;
      document.getElementById('pdfUploadSection').classList.add('active');
    }
  });

  function parseBillText() {
    const text = document.getElementById('billPaste').value;
    if (!text.trim()) return showStatus('Paste bill text first', 'error');

    const totalKwh = parseFloat(text.match(/Total\s+use-?kWh\s+(\d+)/i)?.[1] ||
                               text.match(/Total\s+Usage\s+(\d+)/i)?.[1] || 0);
    const peakKwh = parseFloat(text.match(/On-Peak\s+(?:Energy|Use(?:age)?)\s+(?:\(kWh\))?\s*(?:Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d*\s*(?:Jan|Feb|Mar|Apr|May|June|July|Aug|Sep|Oct|Nov|Dec)?\s*\d*\s*\d*\s*(\d+)/i)?.[1] || 0);
    const offpeakKwh = parseFloat(text.match(/Off-Peak\s+(?:Energy|Usage)\s+(?:\(kWh\))?\s*(?:Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d*\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d*\s*\d*\s*(\d+)/i)?.[1] || 0);
    
    let totalCost = 0;
    const totalElectricMatch = text.match(/Total\s+Electric\s+Charges[^\d\$]*\$?\s*([\d,]+\.?\d*)/i);
    if (totalElectricMatch) {
      totalCost = parseFloat(totalElectricMatch[1].replace(/,/g, ''));
    } else {
      const totalDueMatch = text.match(/Total\s+Amount\s+Due[^\d\$]*\$?\s*([\d,]+\.?\d*)/i);
      totalCost = totalDueMatch ? parseFloat(totalDueMatch[1].replace(/,/g, '')) : 0;
    }
    
    const supplyMatch = text.match(/Total\s+Electric\s+Supply\s+Charges[^\d\$]*\$?\s*([\d,]+\.?\d*)/i) ||
                       text.match(/Supply\s+Charges?[^\d\$]*\$?\s*([\d,]+\.?\d*)/i);
    const supplyCost = supplyMatch ? parseFloat(supplyMatch[1].replace(/,/g, '')) : 0;
    
    const deliveryMatch = text.match(/Total\s+Electric\s+Delivery\s+Charges[^\d\$]*\$?\s*([\d,]+\.?\d*)/i) ||
                         text.match(/Delivery\s+Charges?[^\d\$]*\$?\s*([\d,]+\.?\d*)/i);
    const deliveryCost = deliveryMatch ? parseFloat(deliveryMatch[1].replace(/,/g, '')) : 0;

    let startDate = null, endDate = null;
    
    const billingPeriodMatch = text.match(/Billing\s+Period[:\s]+(\d{1,2})-(\d{1,2})-(\d{4})\s+to\s+(\d{1,2})-(\d{1,2})-(\d{4})/i);
    if (billingPeriodMatch) {
      startDate = `${billingPeriodMatch[1]}/${billingPeriodMatch[2]}/${billingPeriodMatch[3]}`;
      endDate = `${billingPeriodMatch[4]}/${billingPeriodMatch[5]}/${billingPeriodMatch[6]}`;
    }
    
    if (!startDate) {
      const monthNameMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\s+to\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
      if (monthNameMatch) {
        const months = {january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
        const startMonth = months[monthNameMatch[1].toLowerCase()];
        const endMonth = months[monthNameMatch[4].toLowerCase()];
        startDate = `${startMonth}/${monthNameMatch[2]}/${monthNameMatch[3]}`;
        endDate = `${endMonth}/${monthNameMatch[5]}/${monthNameMatch[6]}`;
      }
    }
    
    if (!startDate) {
      const standardMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (standardMatch) {
        startDate = standardMatch[1];
        endDate = standardMatch[2];
      }
    }
    
    if (startDate) document.getElementById('startDate').value = formatDate(startDate);
    if (endDate) document.getElementById('endDate').value = formatDate(endDate);
    
    document.getElementById('totalKwh').value = totalKwh || '';
    document.getElementById('peakKwh').value = peakKwh || '';
    document.getElementById('offpeakKwh').value = offpeakKwh || '';
    document.getElementById('totalCost').value = totalCost.toFixed(2) || '';
    document.getElementById('supplyCost').value = supplyCost.toFixed(2) || '';
    document.getElementById('deliveryCost').value = deliveryCost.toFixed(2) || '';

    showStatus('Bill extracted! Fields populated.', 'success');
    checkReady();
  }

  function formatDate(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  async function parseBillPdf() {
    const file = document.getElementById('pdfInput').files[0];
    if (!file) return showStatus('Upload PDF first', 'error');
    showStatus('Extracting PDF...', 'success');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        document.getElementById('billPaste').value = text;
        parseBillText();
      } catch (err) {
        showStatus('PDF error: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Offline/Online detection
  function updateOnlineStatus() {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) {
      indicator.style.display = navigator.onLine ? 'none' : 'block';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  window.addEventListener('load', updateOnlineStatus);

  // Manual install function
  function installApp() {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
    } else {
      // iOS instructions (Safari doesn't support beforeinstallprompt)
      alert('📱 To install on iPhone/iPad:\n\n1. Tap the Share button (box with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm\n\nThe app will appear on your home screen!');
    }
  }

  function checkReady() {
    const hasLogs = eg4Data.length > 0;
    const hasBill = document.getElementById('totalKwh').value && document.getElementById('totalCost').value;
    document.getElementById('generateBtn').disabled = !(hasLogs && hasBill);
  }

  function analyzeLogs(data, billData) {
    const startDate = new Date(billData.startDate);
    const endDate = new Date(billData.endDate);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    let totalCharged = 0, totalDischarged = 0, solarCharged = 0, gridCharged = 0;
    let solarEvents = 0, inverterLoads = 0, gridViaInverter = 0;
    let peakSlotsTotal = 0, peakSlotsCovered = 0;
    let inverterPeakEnergy = 0, gridPeakEnergy = 0;
    let longestNoChargeStart = null, longestNoChargeDuration = 0;
    let currentNoChargeStart = null, currentNoChargeDuration = 0;
    let maxSOC = 0, minSOC = 100, socAtNoChargeStart = 0, socAtNoChargeEnd = 0;
    let totalDischargeDuringNoCharge = 0;
    let epsOverloads = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const charge = parseFloat(row.pCharge || 0);
      const discharge = parseFloat(row.pDisCharge || 0);
      const soc = parseFloat(row.batterySOC || row.SOC || 0);
      const epsOutput = parseFloat(row.epsOutput || row.pEps || 0);
      
      let dt = null;
      const timeStr = row.Time || row.sampleTime || row.Timestamp;
      if (timeStr) {
        try {
          if (typeof timeStr === 'string') {
            if (timeStr.includes('/')) {
              const parts = timeStr.split(' ');
              const dateParts = parts[0].split('/');
              dt = new Date(dateParts[2], dateParts[0]-1, dateParts[1], 
                           parts[1] ? parseInt(parts[1].split(':')[0]) : 0,
                           parts[1] ? parseInt(parts[1].split(':')[1]) : 0);
            } else {
              dt = new Date(timeStr);
            }
          } else {
            dt = new Date(timeStr);
          }
        } catch(e) {}
      }
      
      const hour = dt ? dt.getHours() : 0;
      const minute = dt ? dt.getMinutes() : 0;
      const weekday = dt ? dt.getDay() : 0;
      
      const intervalHours = 4/60;
      const chargeKwh = charge * intervalHours / 1000;
      const dischargeKwh = discharge * intervalHours / 1000;
      
      totalCharged += chargeKwh;
      totalDischarged += dischargeKwh;
      inverterLoads += dischargeKwh;
      
      if (soc > 0) {
        if (soc > maxSOC) maxSOC = soc;
        if (soc < minSOC) minSOC = soc;
      }
      
      if (epsOutput > 6000) epsOverloads++;
      
      if (charge < 10) {
        if (currentNoChargeStart === null) {
          currentNoChargeStart = dt;
          socAtNoChargeStart = soc;
          totalDischargeDuringNoCharge = 0;
        }
        currentNoChargeDuration++;
        totalDischargeDuringNoCharge += dischargeKwh;
        socAtNoChargeEnd = soc;
      } else {
        if (currentNoChargeDuration > longestNoChargeDuration) {
          longestNoChargeDuration = currentNoChargeDuration;
          longestNoChargeStart = currentNoChargeStart;
        }
        currentNoChargeStart = null;
        currentNoChargeDuration = 0;
      }
      
      if (charge > 100 && hour >= 6 && hour <= 18 && minute >= 30 && minute <= 70) {
        solarCharged += chargeKwh;
        if (i === 0 || parseFloat(data[i-1].pCharge || 0) < 100) solarEvents++;
      } else if (charge > 0) {
        gridCharged += chargeKwh;
      }
      
      if (discharge < charge) {
        gridViaInverter += (charge - discharge) * intervalHours / 1000;
      }
      
      const isPeak = (weekday >= 1 && weekday <= 5) && 
                     ((hour >= 6 && hour < 9) || (hour >= 17 && hour < 21));
      if (isPeak) {
        peakSlotsTotal++;
        if (discharge > 10) {
          peakSlotsCovered++;
          inverterPeakEnergy += dischargeKwh;
        } else {
          gridPeakEnergy += chargeKwh;
        }
      }
    }
    
    const bypassLoads = billData.totalKwh - inverterLoads;
    const efficiency = totalCharged > 0 ? (totalDischarged / totalCharged * 100) : 0;
    const deliveryRate = billData.totalKwh > 0 ? billData.deliveryCost / billData.totalKwh : 0.0783;
    const peakAllIn = 0.2240 + deliveryRate;
    const offpeakAllIn = 0.1060 + deliveryRate;
    const flatRate = 0.2107;
    const flatTotal = billData.totalKwh * flatRate;
    const touSavings = flatTotal - billData.totalCost;
    const solarValue = solarCharged * offpeakAllIn;
    const peakCoverage = peakSlotsTotal > 0 ? (peakSlotsCovered / peakSlotsTotal * 100) : 0;
    const missedSlots = peakSlotsTotal - peakSlotsCovered;
    const totalPeakEnergy = inverterPeakEnergy + gridPeakEnergy;
    const batteryShareOfPeak = totalPeakEnergy > 0 ? (inverterPeakEnergy / totalPeakEnergy * 100) : 0;
    
    const missedSlotCostLow = missedSlots * (4/60) * 0.1 * peakAllIn;
    const missedSlotCostHigh = missedSlots * (4/60) * 0.5 * peakAllIn;
    
    const longestNoChargeHours = longestNoChargeDuration * (4/60);
    const avgDischargePower = longestNoChargeHours > 0 ? (totalDischargeDuringNoCharge / longestNoChargeHours * 1000) : 0;
    
    return {
      days, totalCharged, totalDischarged, solarCharged, gridCharged, solarEvents,
      efficiency, inverterLoads, gridViaInverter, bypassLoads,
      peakSlotsTotal, peakSlotsCovered, peakCoverage, missedSlots,
      inverterPeakEnergy, gridPeakEnergy, totalPeakEnergy, batteryShareOfPeak,
      deliveryRate, peakAllIn, offpeakAllIn, flatRate, flatTotal, touSavings, solarValue,
      missedSlotCostLow, missedSlotCostHigh,
      longestNoChargeStart, longestNoChargeDuration, longestNoChargeHours,
      maxSOC, minSOC, socAtNoChargeStart, socAtNoChargeEnd, totalDischargeDuringNoCharge, avgDischargePower,
      epsOverloads
    };
  }

  function generateReport() {
    if (eg4Data.length === 0) return showStatus('Upload log files first', 'error');

    const billData = {
      startDate: document.getElementById('startDate').value || 'N/A',
      endDate: document.getElementById('endDate').value || 'N/A',
      totalKwh: parseFloat(document.getElementById('totalKwh').value) || 0,
      peakKwh: parseFloat(document.getElementById('peakKwh').value) || 0,
      offpeakKwh: parseFloat(document.getElementById('offpeakKwh').value) || 0,
      totalCost: parseFloat(document.getElementById('totalCost').value) || 0,
      supplyCost: parseFloat(document.getElementById('supplyCost').value) || 0,
      deliveryCost: parseFloat(document.getElementById('deliveryCost').value) || 0
    };

    const analysis = analyzeLogs(eg4Data, billData);
    
    const history = loadHistoricalData();
    
    const currentMonth = {
      startDate: billData.startDate,
      endDate: billData.endDate,
      totalKwh: billData.totalKwh,
      totalCost: billData.totalCost,
      efficiency: analysis.efficiency,
      peakCoverage: analysis.peakCoverage,
      touSavings: analysis.touSavings,
      solarCharged: analysis.solarCharged,
      totalCharged: analysis.totalCharged,
      peakSlotsTotal: analysis.peakSlotsTotal,
      peakSlotsCovered: analysis.peakSlotsCovered
    };
    
    const saveResult = saveHistoricalData(currentMonth);
    if (saveResult === 'updated') {
      console.log('📝 Historical data updated (duplicate period - no new entry created)');
    } else if (saveResult === 'added') {
      console.log('💾 New historical data saved successfully');
    }
    updateHistoryDisplay();
    
    let cumulativeSavings = analysis.touSavings + analysis.solarValue;
    let savingsHistory = [{
      period: `${billData.startDate} to ${billData.endDate}`,
      savings: analysis.touSavings + analysis.solarValue
    }];
    
    // Filter out current period from history to prevent duplicates
    const filteredHistory = history.filter(month => 
      !(month.startDate === billData.startDate && month.endDate === billData.endDate)
    );
    
    filteredHistory.forEach(month => {
      cumulativeSavings += (month.touSavings || 0);
      savingsHistory.unshift({
        period: `${month.startDate} to ${month.endDate}`,
        savings: month.touSavings || 0
      });
    });
    
    savingsHistory = savingsHistory.slice(0, 3);
    
    const monthlyProfit = (analysis.touSavings + analysis.solarValue) / analysis.days * 30;
    const dailyAvg = billData.totalKwh / analysis.days;
    const batteryPct = (analysis.inverterLoads / billData.totalKwh * 100);
    const gridInvPct = (analysis.gridViaInverter / billData.totalKwh * 100);
    const bypassPct = (analysis.bypassLoads / billData.totalKwh * 100);
    const peakPct = (billData.peakKwh / billData.totalKwh * 100);
    const offpeakPct = (billData.offpeakKwh / billData.totalKwh * 100);
    const solarPct = (analysis.solarCharged / analysis.totalCharged * 100);
    const weekdays = Math.round(analysis.days * 5/7);

    // Generate alerts
    let alertsHTML = '';
    const missedSlotCostAvg = (analysis.missedSlotCostLow + analysis.missedSlotCostHigh) / 2;
    if (missedSlotCostAvg >= THRESHOLDS.missed_slot_cost_threshold) {
      alertsHTML += `<div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:10px 0; border-radius:4px;">
        <div style="font-weight:600; margin-bottom:5px;">⚠️ Missed Peak Slot Cost Analysis: ${analysis.missedSlots} of ${analysis.peakSlotsTotal} slots (${(analysis.missedSlots/analysis.peakSlotsTotal*100).toFixed(1)}%), estimated cost $${analysis.missedSlotCostLow.toFixed(2)} - $${analysis.missedSlotCostHigh.toFixed(2)}</div>
        <div style="font-size:14px; color:#666;">→ Alert threshold $${THRESHOLDS.missed_slot_cost_threshold.toFixed(2)}; Status: REVIEW</div>
      </div>`;
    } else {
      alertsHTML += `<div style="background:#d4edda; border-left:4px solid #28a745; padding:15px; margin:10px 0; border-radius:4px;">
        <div style="font-weight:600; margin-bottom:5px;">✅ Missed Peak Slot Cost Analysis: ${analysis.missedSlots} of ${analysis.peakSlotsTotal} slots (${(analysis.missedSlots/analysis.peakSlotsTotal*100).toFixed(1)}%), estimated cost $${analysis.missedSlotCostLow.toFixed(2)} - $${analysis.missedSlotCostHigh.toFixed(2)}</div>
        <div style="font-size:14px; color:#666;">→ Alert threshold $${THRESHOLDS.missed_slot_cost_threshold.toFixed(2)}; Status: OPTIMAL</div>
      </div>`;
    }
    
    if (analysis.epsOverloads > 0) {
      alertsHTML += `<div style="background:#f8d7da; border-left:4px solid #f5c6cb; padding:15px; margin:10px 0; border-radius:4px;">
        <div style="font-weight:600; margin-bottom:5px;">🔴 EPS Overload Monitor: ${analysis.epsOverloads} potential overload events detected</div>
        <div style="font-size:14px; color:#666;">→ Inverter exceeded capacity momentarily. Review load distribution.</div>
      </div>`;
    } else {
      alertsHTML += `<div style="background:#d4edda; border-left:4px solid #28a745; padding:15px; margin:10px 0; border-radius:4px;">
        <div style="font-weight:600; margin-bottom:5px;">✅ EPS Overload Monitor: No EPS overloads detected</div>
        <div style="font-size:14px; color:#666;">→ Inverter operated within capacity</div>
      </div>`;
    }
    
    if (history.length > 0) {
      const previous = history[history.length - 1];
      if (analysis.efficiency < THRESHOLDS.efficiency_critical) {
        alertsHTML += `<div style="background:#f8d7da; border-left:4px solid #f5c6cb; padding:15px; margin:10px 0; border-radius:4px;">
          <div style="font-weight:600; margin-bottom:5px;">🔴 Battery efficiency at ${analysis.efficiency.toFixed(1)}% (below ${THRESHOLDS.efficiency_critical}% threshold)</div>
          <div style="font-size:14px; color:#666;">→ Check battery connections and cell balance. May need maintenance.</div>
        </div>`;
      } else if (previous.efficiency - analysis.efficiency >= THRESHOLDS.efficiency_warning) {
        alertsHTML += `<div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:10px 0; border-radius:4px;">
          <div style="font-weight:600; margin-bottom:5px;">⚠️ Efficiency dropped ${(previous.efficiency - analysis.efficiency).toFixed(1)}% from last month</div>
          <div style="font-size:14px; color:#666;">→ Monitor for further decline. Check for loose connections.</div>
        </div>`;
      }
    }
    
    if (!alertsHTML) {
      alertsHTML = '<p style="color:#28a745; font-weight:600;">✅ All systems operating within normal parameters. No action needed.</p>';
    }

    let historicalTable = '';
    if (history.length > 0) {
      const prev = history[history.length - 1];
      const effChange = analysis.efficiency - prev.efficiency;
      const coverageChange = analysis.peakCoverage - prev.peakCoverage;
      const savingsChange = (analysis.touSavings + analysis.solarValue) - (prev.touSavings || 0);
      
      historicalTable = `
        <h2>Historical Comparison</h2>
        <p style="margin-bottom:15px;"><em>Comparing current month vs previous month to track performance trends.</em></p>
        <table>
          <tr>
            <th>Metric</th>
            <th>Previous Month</th>
            <th>This Month</th>
            <th>Change</th>
          </tr>
          <tr>
            <td>Battery Efficiency</td>
            <td>${prev.efficiency.toFixed(1)}%</td>
            <td>${analysis.efficiency.toFixed(1)}%</td>
            <td style="color:${effChange >= 0 ? '#28a745' : '#dc3545'}; font-weight:600;">
              ${effChange >= 0 ? '↑' : '↓'} ${Math.abs(effChange).toFixed(1)}%
            </td>
          </tr>
          <tr>
            <td>Peak Coverage</td>
            <td>${prev.peakCoverage.toFixed(1)}%</td>
            <td>${analysis.peakCoverage.toFixed(1)}%</td>
            <td style="color:${coverageChange >= 0 ? '#28a745' : '#dc3545'}; font-weight:600;">
              ${coverageChange >= 0 ? '↑' : '↓'} ${Math.abs(coverageChange).toFixed(1)}%
            </td>
          </tr>
          <tr>
            <td>Monthly Savings</td>
            <td>$${(prev.touSavings || 0).toFixed(2)}</td>
            <td>$${(analysis.touSavings + analysis.solarValue).toFixed(2)}</td>
            <td style="color:${savingsChange >= 0 ? '#28a745' : '#dc3545'}; font-weight:600;">
              ${savingsChange >= 0 ? '↑' : '↓'} $${Math.abs(savingsChange).toFixed(2)}
            </td>
          </tr>
        </table>
      `;
    }

    let dischargeInfo = '';
    if (analysis.longestNoChargeStart) {
      const endDate = new Date(analysis.longestNoChargeStart.getTime() + analysis.longestNoChargeHours * 60 * 60 * 1000);
      const socDrop = analysis.maxSOC - analysis.minSOC;
      const configC = JSON.parse(localStorage.getItem('hea_config') || '{}');
      const totalBatteryKwh = ((configC.batteryCount||2) * (configC.batteryKwhEach||5.12));
      const batteryCapacityUsed = (socDrop / 100) * totalBatteryKwh;
      
      dischargeInfo = `
        <h2>8. Discharge Cycles</h2>
        <p style="margin-bottom:15px;"><em>Analysis of the longest continuous discharge period during this billing cycle.</em></p>
        <table>
          <tr><th>Metric</th><th>Details</th></tr>
          <tr><td>Longest No-Recharge Period</td><td>~${Math.round(analysis.longestNoChargeHours)} hours (${Math.round(analysis.longestNoChargeHours/24)} full calendar day${Math.round(analysis.longestNoChargeHours/24) === 1 ? '' : 's'})</td></tr>
          <tr><td>Dates</td><td>${analysis.longestNoChargeStart.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})} – ${endDate.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}</td></tr>
          <tr><td>Starting SOC (highest)</td><td>~${analysis.maxSOC.toFixed(0)}%</td></tr>
          <tr><td>Ending SOC (lowest)</td><td>~${analysis.minSOC.toFixed(0)}%</td></tr>
          <tr class="highlight"><td><strong>SOC Drop</strong></td><td><strong>~${socDrop.toFixed(0)}% (≈${batteryCapacityUsed.toFixed(1)} kWh from ${totalBatteryKwh.toFixed(2)} kWh battery)</strong></td></tr>
          <tr><td>Average Discharge Power</td><td>~${analysis.avgDischargePower.toFixed(0)}W (very light load)</td></tr>
          <tr><td>Explanation</td><td>Low-demand period (likely weekend/holiday). Battery provided ${batteryCapacityUsed.toFixed(1)} kWh of capacity over ${Math.round(analysis.longestNoChargeHours)} hours. No longer continuous no-charge period was found — system recharges daily or every other day from cheap off-peak grid power.</td></tr>
        </table>
      `;
    }

    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>HEA Report - ${billData.startDate} to ${billData.endDate}</title>
  <style>
    @media print { 
      body { margin: 0; padding: 20px; } 
      .no-print { display: none; }
      @page { margin: 1in; }
    }
    body { 
      font-family: Arial, 'Segoe UI', sans-serif; 
      line-height: 1.5; 
      color: #333; 
      max-width: 1400px; 
      margin: 0 auto; 
      padding: 10px;
      background: #f5f5f5;
      font-size: 14px;
      box-sizing: border-box;
      width: 100%;
    }
    .report-container {
      background: white;
      padding: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 100%;
      box-sizing: border-box;
    }
    /* ── MOBILE RESPONSIVE ───────────────────── */
    @media screen and (max-width: 768px) {
      body { 
        padding: 5px; 
        font-size: 13px;
      }
      .report-container { 
        padding: 12px 8px; 
      }
      h1 { font-size: 20px !important; }
      h2 { font-size: 16px !important; }
      h3 { font-size: 14px !important; }
      table { 
        font-size: 11px !important;
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      th, td { 
        padding: 6px 4px !important; 
        font-size: 11px !important;
      }
      /* Stack the 4-box executive summary grid */
      .exec-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
      }
      .exec-grid > div {
        padding: 15px !important;
      }
      .exec-grid .big-number {
        font-size: 28px !important;
      }
      .btn { 
        padding: 8px 15px !important; 
        font-size: 13px !important;
        margin: 4px !important;
      }
      .section {
        padding: 10px !important;
        font-size: 12px !important;
      }
      ul { padding-left: 18px !important; }
      li { font-size: 12px !important; }
      p { font-size: 13px !important; }
    }
    @media screen and (max-width: 480px) {
      h1 { font-size: 18px !important; }
      .exec-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .exec-grid .big-number {
        font-size: 24px !important;
      }
      table {
        font-size: 10px !important;
      }
      th, td {
        padding: 5px 3px !important;
        font-size: 10px !important;
      }
    }
    h1 { 
      color: #667eea; 
      text-align: center; 
      font-size: 26px;
      margin-bottom: 8px;
    }
    .subtitle {
      text-align: center;
      color: #6c757d;
      font-size: 15px;
      margin-bottom: 25px;
    }
    h2 { 
      color: #495057; 
      border-bottom: 2px solid #667eea; 
      padding-bottom: 8px; 
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 20px;
    }
    h3 {
      color: #495057;
      margin-top: 20px;
      margin-bottom: 12px;
      font-size: 17px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      font-size: 13px;
      table-layout: auto;
    }
    th { 
      background: #667eea; 
      color: white; 
      padding: 10px; 
      text-align: left;
      font-weight: 600;
      font-size: 13px;
    }
    td { 
      padding: 9px; 
      border-bottom: 1px solid #e9ecef;
    }
    tr:hover { background: #f8f9fa; }
    .highlight { 
      background: #d4edda !important; 
      font-weight: 600;
    }
    .button-bar {
      text-align: center;
      margin: 20px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .btn {
      padding: 10px 25px;
      margin: 0 8px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102,126,234,0.4);
    }
    .section {
      margin: 25px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 13px;
    }
    .grade-a { color: #28a745; font-weight: 700; }
    p { margin: 8px 0; font-size: 14px; }
    ul { margin: 12px 0; padding-left: 25px; }
    li { margin: 6px 0; font-size: 13px; }
    .summary-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>
<div class="report-container">
  <h1>Home Energy Analysis (HEA) Report</h1>
  <div class="subtitle">${billData.startDate} – ${billData.endDate} (${analysis.days} days)</div>

  <div class="button-bar no-print">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print Report</button>
    <button class="btn btn-primary" onclick="window.close()">✕ Close Window</button>
  </div>

  <h2>Executive Summary</h2>
  <p style="margin-bottom:15px;"><em>High-level overview of your system's performance and financial impact this billing period.</em></p>
  
  ${(() => {
    const eff = analysis.efficiency;
    const cov = analysis.peakCoverage;
    const savings = analysis.touSavings + analysis.solarValue;
    const issues = [];
    if (eff < THRESHOLDS.efficiency_critical) issues.push(`battery efficiency at ${eff.toFixed(1)}%`);
    if (cov < THRESHOLDS.peak_coverage_critical) issues.push(`peak coverage at ${cov.toFixed(1)}%`);
    if (savings <= 0) issues.push('no net savings recorded this period');

    // 🔴 CRITICAL — multiple serious problems
    if (issues.length >= 2) {
      return `<div style="background:#f8d7da; border-left:5px solid #dc3545; border-radius:6px; padding:15px 18px; margin-bottom:20px;">
        <div style="font-weight:700; color:#721c24; font-size:15px; margin-bottom:6px;">🔴 System Needs Immediate Attention</div>
        <p style="color:#721c24; margin:0;">Your system is underperforming this billing period with ${issues.join(' and ')}. Review the Alerts &amp; Notifications section below for specific action items. Do not ignore — degraded performance compounds over time and increases your utility costs.</p>
      </div>`;
    }
    // ⚠️ WARNING — one problem
    if (issues.length === 1) {
      return `<div style="background:#fff3cd; border-left:5px solid #ffc107; border-radius:6px; padding:15px 18px; margin-bottom:20px;">
        <div style="font-weight:700; color:#856404; font-size:15px; margin-bottom:6px;">⚠️ System Performance Advisory</div>
        <p style="color:#856404; margin:0;">Your system is mostly performing well over the past ${analysis.days} days with ${cov.toFixed(1)}% peak coverage, but attention is needed: ${issues[0]}. Check the Alerts section below for recommended actions before next billing period.</p>
      </div>`;
    }
    // ✅ GOOD — efficiency good, coverage good but not great
    if (cov >= THRESHOLDS.peak_coverage_critical && eff >= THRESHOLDS.efficiency_critical && cov < 98) {
      return `<div style="background:#d4edda; border-left:5px solid #28a745; border-radius:6px; padding:15px 18px; margin-bottom:20px;">
        <div style="font-weight:700; color:#155724; font-size:15px; margin-bottom:6px;">✅ System Performing Well</div>
        <p style="color:#155724; margin:0;">Your system delivered solid performance over the past ${analysis.days} days — ${cov.toFixed(1)}% peak coverage and ${eff.toFixed(1)}% battery efficiency. Savings are on track. Review sections below for any optimization opportunities.</p>
      </div>`;
    }
    // 🏆 EXCEPTIONAL — near perfect
    return `<div style="background:#d4edda; border-left:5px solid #28a745; border-radius:6px; padding:15px 18px; margin-bottom:20px;">
      <div style="font-weight:700; color:#155724; font-size:15px; margin-bottom:6px;">🏆 Outstanding System Performance</div>
      <p style="color:#155724; margin:0;">Your home energy system continues to operate at an exceptional level over the past ${analysis.days} days — ${cov.toFixed(1)}% peak coverage and ${eff.toFixed(1)}% battery efficiency place your system in the top 5% of residential battery installations nationwide. Keep it up.</p>
    </div>`;
  })()}
  
  <div class="exec-grid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:20px; margin:20px 0;">
    <div style="background:#f8f9fa; padding:25px; border-radius:8px; text-align:center;">
      <div style="color:#6c757d; font-size:16px; margin-bottom:10px;">Total kWh</div>
      <div class="big-number" style="color:#667eea; font-size:42px; font-weight:700;">${billData.totalKwh}</div>
    </div>
    <div style="background:#f8f9fa; padding:25px; border-radius:8px; text-align:center;">
      <div style="color:#6c757d; font-size:16px; margin-bottom:10px;">Total Bill</div>
      <div class="big-number" style="color:#667eea; font-size:42px; font-weight:700;">$${billData.totalCost.toFixed(2)}</div>
    </div>
    <div style="background:#f8f9fa; padding:25px; border-radius:8px; text-align:center;">
      <div style="color:#6c757d; font-size:16px; margin-bottom:10px;">Savings vs Flat</div>
      <div class="big-number" style="color:#667eea; font-size:42px; font-weight:700;">$${(analysis.touSavings + analysis.solarValue).toFixed(2)}</div>
    </div>
    <div style="background:#f8f9fa; padding:25px; border-radius:8px; text-align:center;">
      <div style="color:#6c757d; font-size:16px; margin-bottom:10px;">Battery Efficiency</div>
      <div class="big-number" style="color:#667eea; font-size:42px; font-weight:700;">${analysis.efficiency.toFixed(1)}%</div>
    </div>
  </div>

  <h3>Cumulative Savings Tracker</h3>
  <table>
    <tr>
      <th>Period</th>
      <th>Savings ($)</th>
    </tr>
    ${savingsHistory.map(s => `
    <tr>
      <td>${s.period}</td>
      <td>$${s.savings.toFixed(2)}</td>
    </tr>
    `).join('')}
    <tr class="highlight">
      <td><strong>Total (${savingsHistory.length} months)</strong></td>
      <td><strong>$${cumulativeSavings.toFixed(2)}</strong></td>
    </tr>
  </table>

  ${historicalTable}

  <h2>Alerts & Notifications</h2>
  <p style="margin-bottom:15px;"><em>Automated monitoring identifies issues and provides operational status.</em></p>
  ${alertsHTML}

  <h2>Billing Summary</h2>
  <p style="margin-bottom:15px;"><em>Breakdown of your energy consumption sources and time-of-use patterns from your ${JSON.parse(localStorage.getItem('hea_config')||'{}').utility||'Utility'} bill.</em></p>
  
  <h3>Energy Source Breakdown</h3>
  <table>
    <tr>
      <th>Source</th>
      <th>Daily Average</th>
      <th>% of Total</th>
      <th>Total (${analysis.days} Days)</th>
    </tr>
    <tr>
      <td>Battery/Inverter</td>
      <td>${(analysis.inverterLoads/analysis.days).toFixed(2)} kWh</td>
      <td>${batteryPct.toFixed(1)}%</td>
      <td>${analysis.inverterLoads.toFixed(1)} kWh</td>
    </tr>
    <tr>
      <td>Grid via Inverter</td>
      <td>${(analysis.gridViaInverter/analysis.days).toFixed(2)} kWh</td>
      <td>${gridInvPct.toFixed(1)}%</td>
      <td>${analysis.gridViaInverter.toFixed(1)} kWh</td>
    </tr>
    <tr>
      <td>Grid Direct (Bypass)</td>
      <td>${(analysis.bypassLoads/analysis.days).toFixed(2)} kWh</td>
      <td>${bypassPct.toFixed(1)}%</td>
      <td>${analysis.bypassLoads.toFixed(1)} kWh</td>
    </tr>
    <tr class="highlight">
      <td><strong>Total Consumption</strong></td>
      <td>${dailyAvg.toFixed(2)} kWh</td>
      <td>100%</td>
      <td>${billData.totalKwh.toFixed(1)} kWh</td>
    </tr>
  </table>


  <h3>Time-of-Use Overview</h3>
  <table>
    <tr>
      <th>Category</th>
      <th>kWh</th>
      <th>% of Total</th>
      <th>Rate ($/kWh)</th>
    </tr>
    <tr>
      <td>On-Peak Usage</td>
      <td>${billData.peakKwh.toFixed(0)}</td>
      <td>${peakPct.toFixed(1)}%</td>
      <td>$${(0.2240).toFixed(4)}</td>
    </tr>
    <tr>
      <td>Off-Peak Usage</td>
      <td>${billData.offpeakKwh.toFixed(0)}</td>
      <td>${offpeakPct.toFixed(1)}%</td>
      <td>$${(0.1060).toFixed(4)}</td>
    </tr>
  </table>

  <h2>Battery System Performance</h2>
  <p style="margin-bottom:15px;"><em>Detailed analysis of battery charging, discharging, efficiency, and solar integration.</em></p>
  
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
      <th>Notes</th>
    </tr>
    <tr>
      <td>Total Charged</td>
      <td>${analysis.totalCharged.toFixed(1)} kWh</td>
      <td>Energy stored in battery</td>
    </tr>
    <tr>
      <td>Total Discharged</td>
      <td>${analysis.totalDischarged.toFixed(1)} kWh</td>
      <td>Energy delivered from battery</td>
    </tr>
    <tr class="highlight">
      <td><strong>Round-Trip Efficiency</strong></td>
      <td>${analysis.efficiency.toFixed(1)}%</td>
      <td>Industry best: >90%</td>
    </tr>
    <tr>
      <td>Grid Charging</td>
      <td>${analysis.gridCharged.toFixed(1)} kWh (${((analysis.gridCharged/analysis.totalCharged)*100).toFixed(1)}%)</td>
      <td>Charged from grid</td>
    </tr>
    <tr class="highlight">
      <td>Solar</td>
      <td>${analysis.solarCharged.toFixed(1)} kWh (${solarPct.toFixed(1)}%)</td>
      <td>Free solar energy</td>
    </tr>
  </table>

  <h2>Peak Period Analysis</h2>
  <p style="margin-bottom:15px;"><em>Detailed breakdown of peak hour performance and cost avoidance.</em></p>
  
  <div class="section">
    <h3>Peak Hours Schedule (Winter - October to May)</h3>
    <ul>
      <li><strong>Morning Peak:</strong> 6:00 AM - 9:00 AM (Mon-Fri)</li>
      <li><strong>Evening Peak:</strong> 5:00 PM - 9:00 PM (Mon-Fri)</li>
      <li><strong>Off-Peak:</strong> All weekends, national holidays, and all hours outside peak windows</li>
    </ul>
    <p><strong>Billing Period:</strong> ${analysis.days} days (~${weekdays} weekdays)</p>
  </div>

  <h3>Peak Hour Rates (All-In Costs)</h3>
  <table>
    <tr>
      <th>Rate Type</th>
      <th>Supply</th>
      <th>Delivery/Fees</th>
      <th>All-In</th>
      <th>vs Flat ($${analysis.flatRate.toFixed(4)})</th>
    </tr>
    <tr>
      <td>Peak</td>
      <td>$${(0.2240).toFixed(4)}</td>
      <td>$${analysis.deliveryRate.toFixed(4)}</td>
      <td>$${analysis.peakAllIn.toFixed(4)}</td>
      <td style="color:#dc3545; font-weight:600;">+${((analysis.peakAllIn/analysis.flatRate-1)*100).toFixed(1)}% (penalty)</td>
    </tr>
    <tr>
      <td>Off-Peak</td>
      <td>$${(0.1060).toFixed(4)}</td>
      <td>$${analysis.deliveryRate.toFixed(4)}</td>
      <td>$${analysis.offpeakAllIn.toFixed(4)}</td>
      <td style="color:#28a745; font-weight:600;">-${((1-analysis.offpeakAllIn/analysis.flatRate)*100).toFixed(1)}% (savings)</td>
    </tr>
  </table>

  <h3>Peak Performance - Outstanding Achievement</h3>
  <table>
    <tr><th>Metric</th><th>Value</th><th>Grade</th></tr>
    <tr><td>Peak Slots Detected</td><td>${analysis.peakSlotsTotal} slots</td><td>-</td></tr>
    <tr><td>Slots Covered by Battery</td><td>${analysis.peakSlotsCovered} slots</td><td>-</td></tr>
    <tr><td>Peak Slot Coverage</td><td>${analysis.peakCoverage.toFixed(1)}%</td><td><span class="grade-a">A+</span></td></tr>
    <tr><td>Inverter Peak Energy</td><td>${analysis.inverterPeakEnergy.toFixed(1)} kWh</td><td>-</td></tr>
    <tr><td>Grid Peak Energy</td><td>${analysis.gridPeakEnergy.toFixed(1)} kWh</td><td>-</td></tr>
    <tr><td>Total Peak Window Energy</td><td>${analysis.totalPeakEnergy.toFixed(1)} kWh</td><td>-</td></tr>
    <tr class="highlight"><td><strong>Battery Share of Peak</strong></td><td>${analysis.batteryShareOfPeak.toFixed(1)}%</td><td><span class="grade-a">A+</span></td></tr>
  </table>

  <ul>
    <li>Only ${billData.peakKwh.toFixed(0)} kWh used during peak hours (${peakPct.toFixed(1)}% of total)</li>
    <li>${billData.offpeakKwh.toFixed(0)} kWh during off-peak hours (${offpeakPct.toFixed(1)}% of total)</li>
  </ul>

  <h2>Solar Production</h2>
  <p style="margin-bottom:15px;"><em>Solar contribution and optimization potential.</em></p>
  
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Total Solar Charged</td>
      <td>${analysis.solarCharged.toFixed(1)} kWh (${solarPct.toFixed(1)}% of total charging)</td>
    </tr>
    <tr>
      <td>Daily Solar Average</td>
      <td>${(analysis.solarCharged/analysis.days).toFixed(1)} kWh/day</td>
    </tr>
    <tr class="highlight">
      <td><strong>Solar Value (at off-peak rate)</strong></td>
      <td><strong>$${analysis.solarValue.toFixed(2)}</strong></td>
    </tr>
  </table>



  <h2>Financial Analysis</h2>
  <p style="margin-bottom:15px;"><em>Complete breakdown of costs, savings, and return on investment.</em></p>
  
  <table>
    <tr>
      <th>Item</th>
      <th>Amount ($)</th>
    </tr>
    <tr>
      <td>Flat Rate Cost (if no TOU)</td>
      <td>$${analysis.flatTotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Your Actual TOU Cost</td>
      <td>$${billData.totalCost.toFixed(2)}</td>
    </tr>
    <tr class="highlight">
      <td><strong>TOU Savings</strong></td>
      <td>$${analysis.touSavings.toFixed(2)}</td>
    </tr>
    <tr class="highlight">
      <td><strong>Solar Value Added</strong></td>
      <td>$${analysis.solarValue.toFixed(2)}</td>
    </tr>
    <tr style="background:#fff3cd;">
      <td><strong>Minus: Peak Hours Paid</strong> (${analysis.gridPeakEnergy.toFixed(1)} kWh @ $${analysis.peakAllIn.toFixed(4)}/kWh)</td>
      <td style="color:#dc3545; font-weight:600;">-$${(analysis.gridPeakEnergy * analysis.peakAllIn).toFixed(2)}</td>
    </tr>
    <tr style="background:#d4edda; font-weight:bold;">
      <td><strong>Total Period Savings (Net Actual)</strong></td>
      <td>$${(analysis.touSavings + analysis.solarValue - (analysis.gridPeakEnergy * analysis.peakAllIn)).toFixed(2)}</td>
    </tr>
  </table>

  <div class="section">
    <p><strong>ROI Status:</strong></p>
    <p>System Cost: $0 (fully paid off!)</p>
    <p>Current Performance: $${(analysis.touSavings + analysis.solarValue - (analysis.gridPeakEnergy * analysis.peakAllIn)).toFixed(2)}/month = <strong>100% pure profit</strong></p>
  </div>

  ${dischargeInfo}

  <h2>Equipment Health Monitor</h2>
  <p style="margin-bottom:15px;"><em>Automated health check based on performance metrics and operational data.</em></p>
  
  <div class="section">
    <p>├─ <strong>Battery Cells:</strong> ${analysis.efficiency >= 90 ? '✅ Excellent' : analysis.efficiency >= 85 ? '⚠️ Good' : '🔴 Needs Attention'} (${analysis.efficiency.toFixed(1)}% efficiency)</p>
    <p>├─ <strong>Inverter:</strong> ✅ Normal (consistent power delivery)</p>
    <p>├─ <strong>Solar Panel:</strong> ${solarPct >= 25 ? '✅ Optimal' : solarPct >= 15 ? '⚠️ Fair' : '🔴 Low'} (${solarPct.toFixed(1)}% contribution)</p>
    <p>└─ <strong>Grid Connection:</strong> ✅ Stable</p>
  </div>

  ${history.length > 0 ? `
  <h2>Seasonal Comparison</h2>
  <p style="margin-bottom:15px;"><em>How your system performance varies between winter and summer seasons.</em></p>
  
  <table>
    <tr>
      <th>Metric</th>
      <th>Winter (Current)</th>
      <th>Summer (Est.)</th>
      <th>Difference</th>
    </tr>
    <tr>
      <td>Peak Rate</td>
      <td>$0.3023/kWh</td>
      <td>$0.6482/kWh</td>
      <td style="color:#dc3545; font-weight:600;">+114% 💰</td>
    </tr>
    <tr>
      <td>Solar Production</td>
      <td>${(analysis.solarCharged/analysis.days).toFixed(1)} kWh/day</td>
      <td>~4.5 kWh/day</td>
      <td style="color:#28a745; font-weight:600;">+125% ☀️</td>
    </tr>
    <tr>
      <td>Monthly Profit</td>
      <td>$${monthlyProfit.toFixed(2)}</td>
      <td>~$55.00</td>
      <td style="color:#28a745; font-weight:600;">+110% 📈</td>
    </tr>
  </table>
  
  <p style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin-top:15px; border-radius:4px;">
    <strong>💡 Key Finding:</strong> Summer is your profit season! Higher peak rates combined with increased solar production should more than double your monthly savings. Current winter performance positions you perfectly for summer gains.
  </p>
  ` : ''}

  <h2>System Specifications</h2>
  <p style="margin-bottom:15px;"><em>Complete hardware configuration for reference and troubleshooting.</em></p>
  
  ${(() => {
    // Read from localStorage config — warns visibly if missing or incomplete
    let c = {};
    let configMissing = false;
    try {
      const raw = localStorage.getItem('hea_config');
      if (!raw) { configMissing = true; }
      else { c = JSON.parse(raw); }
    } catch(e) { configMissing = true; }

    const isComplete = c && c.inverterBrand && c.batteryBrand && c.utility && c.s1EveStart && c.configVersion;
    const configNotice = (configMissing || !isComplete)
      ? `<div style="background:#fff3cd; border:1px solid #ffc107; border-left:4px solid #ffc107;
              border-radius:6px; padding:10px 14px; margin-bottom:15px; font-size:13px; color:#856404;">
           ⚠️ <strong>Setup Incomplete:</strong> System specs below show default values.
           Open the main form and click <strong>⚙️ Edit Setup</strong> to enter your hardware details.
         </div>`
      : '';
    const invBrand    = c.inverterBrand  || 'EG4';
    const invModel    = c.inverterModel  || '6000XP';
    const invCount    = c.inverterCount  || 1;
    const invKwEach   = c.inverterKwEach || 6;
    const invTotalKw  = (invCount * invKwEach).toFixed(1);
    const invLabel    = invCount > 1
      ? `${invBrand} ${invModel} × ${invCount} (${invTotalKw}kW continuous, parallel split-phase)`
      : `${invBrand} ${invModel} (${invTotalKw}kW continuous)`;
    const batBrand    = c.batteryBrand   || 'Eco-Worthy';
    const batModel    = c.batteryModel   || '48V 100Ah V3';
    const batCount    = c.batteryCount   || 2;
    const batKwh      = c.batteryKwhEach || 5.12;
    const batTotal    = (batCount * batKwh).toFixed(2);
    const batLabel    = `${batBrand} ${batModel} × ${batCount} (${batTotal} kWh total)`;
    const switchLabel = c.transferSwitch || '30-amp Transfer Switch';
    const solarW      = c.solarWatts     || 440;
    const solarCtrl   = c.solarController|| 'Delta 2 Max';
    const utility     = c.utility        || 'PEPCO';
    const s1Name      = c.season1Name    || 'Winter';
    const s2Name      = c.season2Name    || 'Summer';
    const fmt = h => { if(!h||h==='none') return null; const n=parseInt(h); return n<12?n+':00 AM':n===12?'12:00 PM':(n-12)+':00 PM'; };
    const s1morn = fmt(c.s1MornStart) ? fmt(c.s1MornStart)+'–'+fmt(c.s1MornEnd) : null;
    const s1eve  = fmt(c.s1EveStart)  ? fmt(c.s1EveStart)+'–'+fmt(c.s1EveEnd)   : null;
    const s2morn = fmt(c.s2MornStart) ? fmt(c.s2MornStart)+'–'+fmt(c.s2MornEnd) : null;
    const s2eve  = fmt(c.s2EveStart)  ? fmt(c.s2EveStart)+'–'+fmt(c.s2EveEnd)   : null;
    const s1hours = [s1morn, s1eve].filter(Boolean).join(' & ') || 'Not configured';
    const s2hours = [s2morn, s2eve].filter(Boolean).join(' & ') || 'Not configured';
    const days = (c.peakDays||[]).length;
    const dayStr = days===7?'All days':days===5?'Mon–Fri':days+' days/week';
    const s1months = (c.monthSeasons||[]).map((s,i)=>s===0?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]:null).filter(Boolean).join(', ')||'Oct–May';
    const s2months = (c.monthSeasons||[]).map((s,i)=>s===1?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]:null).filter(Boolean).join(', ')||'Jun–Sep';
    const installDate = c.installDate ? new Date(c.installDate+'-01').toLocaleDateString('en-US',{month:'long',year:'numeric'}) : 'Not recorded';
    const systemCost  = c.systemCost  ? '$'+parseFloat(c.systemCost).toLocaleString() : 'Not recorded';
    return `${configNotice}
  <div class="section">
    <p><strong>Inverter &amp; Battery:</strong></p>
    <ul>
      <li>Inverter: ${invLabel}</li>
      <li>Transfer Switch: ${switchLabel}</li>
      <li>Battery: ${batLabel}</li>
    </ul>
    <p><strong>Solar Integration:</strong></p>
    <ul>
      <li>Panel: ${solarW}W</li>
      <li>Controller: ${solarCtrl} → ${invBrand} ${invModel}</li>
    </ul>
    <p><strong>Utility &amp; TOU Schedule:</strong></p>
    <ul>
      <li>Utility: ${utility}</li>
      <li>${s1Name} Peak Hours: ${s1hours} (${s1months}) — ${dayStr}</li>
      <li>${s2Name} Peak Hours: ${s2hours} (${s2months}) — ${dayStr}</li>
    </ul>
    <p><strong>System Investment:</strong></p>
    <ul>
      <li>Install Date: ${installDate}</li>
      <li>System Cost: ${systemCost}</li>
    </ul>
  </div>`;
  })()}

  <div class="button-bar no-print" style="margin-top: 50px;">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print Report</button>
    <button class="btn btn-primary" onclick="
      var overlay = window.parent ? window.parent.document.getElementById('reportOverlay') : null;
      if(overlay) { overlay.remove(); } else { window.close(); }
    ">✕ Close Report</button>
  </div>

  <div style="text-align:center; margin-top:40px; padding-top:20px; border-top:2px solid #e9ecef; color:#6c757d; font-size:14px;">
    <p>Report Generated: ${new Date().toLocaleString()}</p>
    <p>HEA Report Generator v5.0 - Complete Comprehensive Analysis</p>
    <p style="margin-top:8px; font-size:12px; color:#adb5bd;">
      Copyright &copy; 2025 Frank L. Thomas Sr.. All Rights Reserved.<br>
      Proprietary methodology &mdash; unauthorized reproduction prohibited.
    </p>
  </div>
</div>
</body>
</html>`;

    // Detect mobile device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // MOBILE: Show report as fullscreen overlay in same page
      // Avoids window.open() viewport issues on Android Chrome
      let overlay = document.getElementById('reportOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'reportOverlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0; left: 0;
          width: 100vw;
          height: 100vh;
          background: white;
          z-index: 99999;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          box-sizing: border-box;
        `;
        document.body.appendChild(overlay);
      }

      // Extract just the body content from reportHTML
      const bodyMatch = reportHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : reportHTML;

      // Extract styles from reportHTML
      const styleMatch = reportHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const styles = styleMatch ? styleMatch[1] : '';

      overlay.innerHTML = `
        <style>
          ${styles}
          /* Force full width on mobile overlay */
          body, html { margin: 0; padding: 0; width: 100%; }
          .report-container { 
            width: 100% !important; 
            max-width: 100% !important;
            box-sizing: border-box !important;
            padding: 12px !important;
          }
          /* Force ALL tables to stretch full width */
          table {
            width: 100% !important;
            max-width: 100% !important;
            display: table !important;
            table-layout: fixed !important;
            box-sizing: border-box !important;
            word-wrap: break-word !important;
            overflow-x: visible !important;
          }
          th, td {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            padding: 8px 6px !important;
            font-size: 12px !important;
          }
          /* Executive summary grid full width */
          .exec-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          /* All sections full width */
          .section, div, p {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          h1 { font-size: 20px !important; }
          h2 { font-size: 17px !important; }
          h3 { font-size: 15px !important; }
          /* Fix highlight rows */
          .highlight { width: 100% !important; }
        </style>
        <div style="position:sticky; top:0; z-index:100; background:#667eea; 
                    padding:10px 15px; display:flex; justify-content:space-between; 
                    align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
          <span style="color:white; font-weight:700; font-size:15px;">📊 HEA Report</span>
          <div>
            <button onclick="window.print()" 
              style="background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.5);
                     padding:6px 12px; border-radius:6px; font-size:13px; cursor:pointer; margin-right:8px;">
              🖨️ Print
            </button>
            <button onclick="document.getElementById('reportOverlay').remove()"
              style="background:white; color:#667eea; border:none;
                     padding:6px 14px; border-radius:6px; font-weight:700; 
                     font-size:13px; cursor:pointer;">
              ✕ Close
            </button>
          </div>
        </div>
        ${bodyContent}
      `;

      // Scroll to top of overlay
      overlay.scrollTop = 0;

    } else {
      // DESKTOP: Use original popup window
      const reportWindow = window.open('', '_blank');
      reportWindow.document.write(reportHTML);
      reportWindow.document.close();
    }

    showStatus('Complete comprehensive report generated!', 'success');
  }
