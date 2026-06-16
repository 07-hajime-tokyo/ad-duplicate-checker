import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const STORAGE = {
  feedbacks: "ad-checker-feedbacks",
  emails: "ad-checker-emails"
};

const LOCAL_PREVIEW_URL = "http://localhost:4173/";

const industryOptions = [
  "未分類",
  "医療・健康",
  "金融・保険",
  "教育",
  "出版",
  "宗教・仏事",
  "旅行・観光",
  "不動産・建設",
  "通販",
  "生活サービス",
  "文化・イベント",
  "行政・団体",
  "その他"
];

const state = {
  papers: [],
  feedbacks: loadStorage(STORAGE.feedbacks, []),
  emails: loadStorage(STORAGE.emails, []),
  selectedDate: toDateInputValue(new Date()),
  selectedMonth: toMonthValue(new Date()),
  confirmedDate: false,
  latestAnalysis: []
};

const els = {
  runtimeStatus: document.querySelector("#runtimeStatus"),
  localUrl: document.querySelector("#localUrl"),
  copyLocalUrl: document.querySelector("#copyLocalUrl"),
  feedbackInput: document.querySelector("#feedbackInput"),
  saveFeedback: document.querySelector("#saveFeedback"),
  toggleFeedback: document.querySelector("#toggleFeedback"),
  feedbackHistory: document.querySelector("#feedbackHistory"),
  feedbackSaved: document.querySelector("#feedbackSaved"),
  emailInput: document.querySelector("#emailInput"),
  saveEmail: document.querySelector("#saveEmail"),
  emailList: document.querySelector("#emailList"),
  prepareMail: document.querySelector("#prepareMail"),
  publicationDate: document.querySelector("#publicationDate"),
  confirmDate: document.querySelector("#confirmDate"),
  dropZone: document.querySelector("#dropZone"),
  pdfInput: document.querySelector("#pdfInput"),
  loadFolderPdfs: document.querySelector("#loadFolderPdfs"),
  copyCodexPrompt: document.querySelector("#copyCodexPrompt"),
  importStatus: document.querySelector("#importStatus"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  currentMonthLabel: document.querySelector("#currentMonthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  metricPdfs: document.querySelector("#metricPdfs"),
  metricPages: document.querySelector("#metricPages"),
  metricAds: document.querySelector("#metricAds"),
  metricAlerts: document.querySelector("#metricAlerts"),
  paperList: document.querySelector("#paperList"),
  pagesGrid: document.querySelector("#pagesGrid"),
  runAnalysis: document.querySelector("#runAnalysis"),
  alertBox: document.querySelector("#alertBox"),
  analysisTable: document.querySelector("#analysisTable")
};

init();

function init() {
  els.localUrl.textContent = LOCAL_PREVIEW_URL;
  els.publicationDate.value = state.selectedDate;
  bindEvents();
  renderAll();
}

function bindEvents() {
  els.copyLocalUrl.addEventListener("click", copyLocalUrl);
  els.saveFeedback.addEventListener("click", saveFeedback);
  els.toggleFeedback.addEventListener("click", toggleFeedbackHistory);
  els.saveEmail.addEventListener("click", saveEmail);
  els.prepareMail.addEventListener("click", prepareAlertMail);
  els.confirmDate.addEventListener("click", confirmSelectedDate);
  els.pdfInput.addEventListener("change", event => importFiles([...event.target.files]));
  els.loadFolderPdfs.addEventListener("click", loadFolderPdfs);
  els.copyCodexPrompt.addEventListener("click", copyCodexPrompt);
  els.prevMonth.addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, -1);
    renderAll();
  });
  els.nextMonth.addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, 1);
    renderAll();
  });
  els.runAnalysis.addEventListener("click", () => {
    runAnalysis();
    renderAll();
  });

  els.dropZone.addEventListener("dragover", event => {
    event.preventDefault();
    els.dropZone.classList.add("is-dragover");
  });
  els.dropZone.addEventListener("dragleave", () => {
    els.dropZone.classList.remove("is-dragover");
  });
  els.dropZone.addEventListener("drop", event => {
    event.preventDefault();
    els.dropZone.classList.remove("is-dragover");
    importFiles([...event.dataTransfer.files].filter(file => file.type === "application/pdf"));
  });

  els.calendarGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    state.selectedDate = button.dataset.date;
    state.selectedMonth = state.selectedDate.slice(0, 7);
    els.publicationDate.value = state.selectedDate;
    renderAll();
  });

  els.emailList.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-email]");
    if (!button) return;
    state.emails = state.emails.filter(email => email !== button.dataset.removeEmail);
    saveStorage(STORAGE.emails, state.emails);
    renderEmailList();
  });

  els.pagesGrid.addEventListener("change", handlePageChange);
  els.pagesGrid.addEventListener("input", handlePageInput);
  els.pagesGrid.addEventListener("click", handlePageClick);
}

async function copyLocalUrl() {
  await navigator.clipboard?.writeText(LOCAL_PREVIEW_URL);
  els.runtimeStatus.textContent = "ローカル確認URLをコピーしました";
}

async function importFiles(files) {
  const pdfFiles = files.filter(file => file && file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfFiles.length) return;

  setBusy(true, `${pdfFiles.length}件のPDFを取り込み中`);
  for (const file of pdfFiles) {
    const date = els.publicationDate.value || state.selectedDate;
    await importPdfBuffer(await file.arrayBuffer(), file.name, date, state.confirmedDate);
  }
  setBusy(false, "取り込み完了");
  runAnalysis();
  renderAll();
  els.pdfInput.value = "";
}

async function loadFolderPdfs() {
  setBusy(true, "フォルダ内PDFを確認中");
  try {
    const response = await fetch("./pdf-manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("pdf-manifest.jsonを読めません");
    const manifest = await response.json();
    let importedCount = 0;
    for (const item of manifest.files || []) {
      const entry = normalizeManifestEntry(item);
      const pdfResponse = await fetch(`./${encodeURIComponent(entry.name)}`);
      if (!pdfResponse.ok) continue;
      const date = entry.paperDates[0]?.date || els.publicationDate.value || state.selectedDate;
      await importPdfBuffer(await pdfResponse.arrayBuffer(), entry.name, date, entry.paperDates.length > 0 || state.confirmedDate, entry.paperDates);
      importedCount += 1;
    }
    setBusy(false, importedCount ? "フォルダ内PDFを取り込みました" : "デモPDFが見つかりません。PDFをアップロードしてください。");
    runAnalysis();
    renderAll();
  } catch (error) {
    setBusy(false, "フォルダ内PDFの読込に失敗");
    els.importStatus.textContent = error.message;
  }
}

async function importPdfBuffer(buffer, fileName, date, dateConfirmed, paperDates = []) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const paper = {
    id: makeId("paper"),
    name: fileName,
    date,
    dateConfirmed,
    importedAt: new Date().toISOString(),
    pageCount: pdf.numPages,
    pages: []
  };

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setBusy(true, `${fileName} ${pageNumber}/${pdf.numPages}ページ`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const normalized = normalizePageCanvas(canvas);
    const pageDate = paperDateForPage(pageNumber, paperDates) || date;
    const pageInfo = createPageInfo(paper, pageNumber, normalized.canvas, normalized.rotation, normalized.autoRotated, pageDate, dateConfirmed);
    paper.pages.push(pageInfo);
  }

  state.papers.push(paper);
  const lastDate = paper.pages.at(-1)?.date || date;
  state.selectedDate = lastDate;
  state.selectedMonth = lastDate.slice(0, 7);
  els.publicationDate.value = lastDate;
}

function createPageInfo(paper, pageNumber, canvas, rotation = 0, autoRotated = false, date = state.selectedDate, dateConfirmed = false) {
  const hashInfo = computeContentHash(canvas);
  const isLate = pageNumber === paper.pageCount || pageNumber === 8;
  const page = {
    id: makeId("page"),
    paperId: paper.id,
    pdfName: paper.name,
    date,
    dateConfirmed,
    pageNumber,
    faceName: `${pageNumber}面`,
    isLate,
    rotation,
    autoRotated,
    orientation: canvas.height >= canvas.width ? "portrait" : "landscape",
    thumbnail: canvas.toDataURL("image/jpeg", 0.82),
    hash: hashInfo.hash,
    contentRatio: hashInfo.contentRatio,
    ads: []
  };

  page.ads.push(createAd(page, pageNumber === 1 ? "記事下メイン" : isLate ? "ラテ中" : "記事下メイン"));
  if (pageNumber === 1) {
    page.ads.push(createAd(page, "題字横"));
    page.ads.push(createAd(page, "題字中"));
  }

  return page;
}

function createAd(page, slot) {
  return {
    id: makeId("ad"),
    pageId: page.id,
    paperId: page.paperId,
    pdfName: page.pdfName,
    date: page.date,
    pageNumber: page.pageNumber,
    slot,
    client: "",
    industry: "未分類",
    appeal: "",
    ocrText: "",
    memo: "",
    verdict: "△",
    reason: "未分析"
  };
}

function saveFeedback() {
  const text = els.feedbackInput.value.trim();
  if (!text) return;
  state.feedbacks.unshift({
    id: makeId("feedback"),
    text,
    createdAt: new Date().toISOString()
  });
  saveStorage(STORAGE.feedbacks, state.feedbacks);
  els.feedbackInput.value = "";
  els.feedbackSaved.textContent = "登録しました";
  renderFeedbackHistory();
}

function toggleFeedbackHistory() {
  const isHidden = els.feedbackHistory.hidden;
  els.feedbackHistory.hidden = !isHidden;
  els.toggleFeedback.setAttribute("aria-expanded", String(isHidden));
  renderFeedbackHistory();
}

function saveEmail() {
  const email = els.emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    els.emailInput.focus();
    return;
  }
  if (!state.emails.includes(email)) {
    state.emails.push(email);
    saveStorage(STORAGE.emails, state.emails);
  }
  els.emailInput.value = "";
  renderEmailList();
}

function confirmSelectedDate() {
  const previousDate = state.selectedDate;
  const date = els.publicationDate.value || state.selectedDate;
  state.confirmedDate = true;
  state.selectedDate = date;
  state.selectedMonth = date.slice(0, 7);
  for (const paper of state.papers) {
    for (const page of paper.pages) {
      if (page.date !== previousDate && page.date !== date) continue;
      page.date = date;
      page.dateConfirmed = true;
      for (const ad of page.ads) ad.date = date;
      paper.dateConfirmed = true;
    }
  }
  setBusy(false, `${date} を確認済みにしました`);
  runAnalysis();
  renderAll();
}

function handlePageChange(event) {
  const target = event.target;
  const page = findPage(target.dataset.pageId);
  const ad = findAd(target.dataset.adId);

  if (target.dataset.field === "faceName" && page) {
    page.faceName = target.value;
  }
  if (target.dataset.field === "pageDate" && page) {
    page.date = target.value;
    page.dateConfirmed = false;
    for (const pageAd of page.ads) pageAd.date = target.value;
    state.selectedDate = target.value;
    state.selectedMonth = target.value.slice(0, 7);
    els.publicationDate.value = target.value;
  }
  if (target.dataset.field === "isLate" && page) {
    page.isLate = target.checked;
  }
  if (target.dataset.field === "industry" && ad) {
    ad.industry = target.value;
  }
  if (target.dataset.field === "slot" && ad) {
    ad.slot = target.value;
  }
  runAnalysis();
  renderAll();
}

function handlePageInput(event) {
  const target = event.target;
  const ad = findAd(target.dataset.adId);
  if (!ad || !target.dataset.field) return;
  ad[target.dataset.field] = target.value;
  runAnalysis();
  renderAnalysis();
  renderSummary();
}

async function handlePageClick(event) {
  const addButton = event.target.closest("[data-add-ad]");
  if (addButton) {
    const page = findPage(addButton.dataset.addAd);
    if (!page) return;
    page.ads.push(createAd(page, page.isLate ? "ラテ中" : "記事下メイン"));
    renderAll();
    return;
  }

  const removeButton = event.target.closest("[data-remove-ad]");
  if (removeButton) {
    const page = findPage(removeButton.dataset.pageId);
    if (!page) return;
    page.ads = page.ads.filter(ad => ad.id !== removeButton.dataset.removeAd);
    runAnalysis();
    renderAll();
    return;
  }

  const ocrButton = event.target.closest("[data-ocr-ad]");
  if (ocrButton) {
    await runOcr(ocrButton.dataset.ocrAd, ocrButton.dataset.pageId);
    return;
  }

  const rotateButton = event.target.closest("[data-rotate-page]");
  if (rotateButton) {
    await rotatePageImage(rotateButton.dataset.rotatePage, Number(rotateButton.dataset.degrees));
  }
}

async function runOcr(adId, pageId) {
  const ad = findAd(adId);
  const page = findPage(pageId);
  if (!ad || !page) return;
  if (!window.Tesseract) {
    ad.ocrText = `${ad.ocrText}\nOCRライブラリを読み込めませんでした。`.trim();
    renderAll();
    return;
  }

  setBusy(true, `${page.pdfName} ${page.pageNumber}面をOCR中`);
  try {
    const result = await window.Tesseract.recognize(page.thumbnail, "jpn+eng", {
      logger: message => {
        if (message.status) {
          const progress = message.progress ? ` ${Math.round(message.progress * 100)}%` : "";
          els.importStatus.textContent = `${message.status}${progress}`;
        }
      }
    });
    ad.ocrText = result.data.text.trim();
    if (ad.industry === "未分類") ad.industry = inferIndustry(ad);
    if (!ad.appeal) ad.appeal = inferAppeal(ad);
    setBusy(false, "OCR完了");
  } catch (error) {
    ad.ocrText = `${ad.ocrText}\nOCR失敗: ${error.message}`.trim();
    setBusy(false, "OCR失敗");
  }
  runAnalysis();
  renderAll();
}

function runAnalysis() {
  const ads = collectAds().filter(ad => ad.date === state.selectedDate);
  const enriched = ads.map(ad => ({ ...ad, page: findPage(ad.pageId) }));

  for (const ad of enriched) {
    const analysis = analyzeAd(ad, enriched);
    const original = findAd(ad.id);
    if (!original) continue;
    original.industry = original.industry === "未分類" ? analysis.industry : original.industry;
    original.verdict = analysis.verdict;
    original.reason = analysis.reason;
  }

  state.latestAnalysis = collectAds()
    .filter(ad => ad.date === state.selectedDate)
    .map(ad => ({ ...ad, page: findPage(ad.pageId) }));
}

function analyzeAd(ad, allAds) {
  const industry = ad.industry && ad.industry !== "未分類" ? ad.industry : inferIndustry(ad);
  const text = normalizeText(`${ad.client} ${industry} ${ad.appeal} ${ad.ocrText} ${ad.memo}`);
  const hasContent = Boolean(normalizeText(`${ad.client} ${ad.appeal} ${ad.ocrText} ${ad.memo}`));
  const reasons = [];
  let verdict = hasContent ? "○" : "△";

  if (!hasContent) {
    reasons.push("広告内容が未入力またはOCR待ち");
  }

  for (const other of allAds) {
    if (other.id === ad.id) continue;
    const otherText = normalizeText(`${other.client} ${other.industry} ${other.appeal} ${other.ocrText} ${other.memo}`);
    const samePage = other.pageId === ad.pageId;
    const imageSimilarity = samePage ? 0 : compareHashes(ad.page?.hash, other.page?.hash);
    const textSimilarity = compareText(text, otherText);
    const sameClient = ad.client && other.client && normalizeText(ad.client) === normalizeText(other.client);
    const sameIndustry = industry !== "未分類" && industry === (other.industry || inferIndustry(other));
    const appealOverlap = overlapKeywords(`${ad.appeal} ${ad.ocrText}`, `${other.appeal} ${other.ocrText}`);

    if (imageSimilarity >= 0.92) {
      verdict = "✕";
      reasons.push(`画像が${other.pdfName} ${other.pageNumber}面とほぼ同一`);
    } else if (imageSimilarity >= 0.82 && verdict !== "✕") {
      verdict = "△";
      reasons.push(`画像が${other.pdfName} ${other.pageNumber}面と類似`);
    }

    if (sameClient) {
      verdict = "✕";
      reasons.push(`広告主が${other.pageNumber}面と重複`);
    }

    if (textSimilarity >= 0.55) {
      verdict = "✕";
      reasons.push(`訴求文が${other.pageNumber}面と高類似`);
    } else if ((textSimilarity >= 0.32 || (sameIndustry && appealOverlap)) && verdict !== "✕") {
      verdict = "△";
      reasons.push(`同業種または訴求が${other.pageNumber}面と近い`);
    }
  }

  if (!reasons.length) reasons.push("同日内で明確な重複は未検出");
  return {
    industry,
    verdict,
    reason: [...new Set(reasons)].slice(0, 4).join(" / ")
  };
}

function renderAll() {
  renderFeedbackHistory();
  renderEmailList();
  renderNavigation();
  renderSummary();
  renderPages();
  renderAnalysis();
}

function renderFeedbackHistory() {
  if (!state.feedbacks.length) {
    els.feedbackHistory.innerHTML = `<div class="history-item"><span class="helper-text">フィードバックはまだありません。</span></div>`;
    return;
  }
  els.feedbackHistory.innerHTML = state.feedbacks
    .map(item => `
      <div class="history-item">
        <span class="history-date">${formatDateTime(item.createdAt)}</span>
        <span>${escapeHtml(item.text)}</span>
      </div>
    `)
    .join("");
}

function renderEmailList() {
  if (!state.emails.length) {
    els.emailList.innerHTML = `<span class="helper-text">登録アドレスなし</span>`;
    return;
  }
  els.emailList.innerHTML = state.emails
    .map(email => `
      <span class="email-chip">
        ${escapeHtml(email)}
        <button class="chip-remove" type="button" aria-label="${escapeHtml(email)}を削除" data-remove-email="${escapeHtml(email)}">×</button>
      </span>
    `)
    .join("");
}

function renderNavigation() {
  const [year, month] = state.selectedMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const today = toDateInputValue(new Date());

  els.currentMonthLabel.textContent = `${year}年${String(month).padStart(2, "0")}月`;
  els.calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateValue = toDateInputValue(date);
    const inMonth = dateValue.startsWith(state.selectedMonth);
    const count = paperCountForDate(dateValue);
    const classes = [
      "calendar-day",
      inMonth ? "" : "is-outside",
      dateValue === today ? "is-today" : "",
      dateValue === state.selectedDate ? "is-active" : "",
      count ? "has-pdf" : ""
    ].filter(Boolean).join(" ");

    return `
      <button class="${classes}" type="button" data-date="${dateValue}" aria-label="${dateValue} ${count ? `${count}件のPDF` : "PDFなし"}">
        <span class="calendar-day-number">${date.getDate()}</span>
        <span class="calendar-day-count">${count}PDF</span>
      </button>
    `;
  }).join("");
}

function renderSummary() {
  const papers = selectedPapers();
  const pages = selectedPages();
  const ads = pages.flatMap(page => page.ads);
  const alertCount = ads.filter(ad => ad.verdict === "✕" || ad.verdict === "△").length;

  els.selectedDateTitle.textContent = state.selectedDate || "日付未選択";
  els.metricPdfs.textContent = papers.length;
  els.metricPages.textContent = pages.length;
  els.metricAds.textContent = ads.length;
  els.metricAlerts.textContent = alertCount;

  if (!papers.length) {
    els.paperList.innerHTML = `<div class="empty-state">PDFを取り込むと、この日に紐づくファイルが表示されます。</div>`;
    return;
  }

  els.paperList.innerHTML = papers
    .map(paper => `
      <div class="paper-item">
        <span class="paper-name">${escapeHtml(paper.name)}</span>
        <span>${paper.pages.length}ページ / ${paper.pages.every(page => page.dateConfirmed) ? "日付確認済み" : "日付未確認"}</span>
        <span class="helper-text">取込: ${formatDateTime(paper.importedAt)}</span>
      </div>
    `)
    .join("");
}

function renderPages() {
  const pages = selectedPages();
  if (!pages.length) {
    els.pagesGrid.innerHTML = `<div class="empty-state">この日付のPDFページはまだありません。</div>`;
    return;
  }

  els.pagesGrid.innerHTML = pages
    .map(page => `
      <article class="page-card">
        <img class="page-thumb ${page.orientation === "portrait" ? "is-portrait" : ""}" src="${page.thumbnail}" alt="${escapeHtml(page.pdfName)} ${page.pageNumber}ページ">
        <div class="page-body">
          <div class="page-title-row">
            <div>
              <h3>${escapeHtml(page.pdfName)}</h3>
              <span class="helper-text">${page.pageNumber}ページ / 紙面日付 ${page.date} / ${page.orientation === "portrait" ? "縦向き" : "横向き"} / ${page.autoRotated ? "自動補正" : `回転${page.rotation}度`} / 内容面積 ${Math.round(page.contentRatio * 100)}%</span>
            </div>
            <span class="tag">${page.dateConfirmed ? "日付確認済み" : "日付未確認"}</span>
          </div>
          <div class="rotation-actions" aria-label="紙面の向き調整">
            <button class="small-button" type="button" data-rotate-page="${page.id}" data-degrees="-90">左90</button>
            <button class="small-button" type="button" data-rotate-page="${page.id}" data-degrees="90">右90</button>
          </div>
          <div class="page-options">
            <label>
              紙面日付
              <input type="date" value="${escapeHtml(page.date)}" data-field="pageDate" data-page-id="${page.id}">
            </label>
            <label>
              面名
              <input value="${escapeHtml(page.faceName)}" data-field="faceName" data-page-id="${page.id}">
            </label>
            <label class="switch-line">
              <input type="checkbox" ${page.isLate ? "checked" : ""} data-field="isLate" data-page-id="${page.id}">
              ラテ面
            </label>
          </div>
          <div class="ad-toolbar">
            <strong>広告枠 ${page.ads.length}件</strong>
            <button class="small-button" type="button" data-add-ad="${page.id}">広告枠追加</button>
          </div>
          ${page.ads.map(ad => renderAdEditor(ad, page)).join("")}
        </div>
      </article>
    `)
    .join("");
}

function renderAdEditor(ad, page) {
  return `
    <div class="ad-editor">
      <div class="ad-toolbar">
        <span class="verdict ${verdictClass(ad.verdict)}">${ad.verdict || "△"}</span>
        <button class="small-button" type="button" data-ocr-ad="${ad.id}" data-page-id="${page.id}">OCR</button>
        <button class="small-button" type="button" data-remove-ad="${ad.id}" data-page-id="${page.id}">削除</button>
      </div>
      <div class="ad-form-grid">
        <label>
          広告枠
          <select data-field="slot" data-ad-id="${ad.id}">
            ${["記事下メイン", "題字横", "題字中", "ラテ中", "その他"].map(slot => `<option value="${slot}" ${slot === ad.slot ? "selected" : ""}>${slot}</option>`).join("")}
          </select>
        </label>
        <label>
          業種
          <select data-field="industry" data-ad-id="${ad.id}">
            ${industryOptions.map(option => `<option value="${option}" ${option === ad.industry ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </label>
        <label>
          広告主
          <input value="${escapeHtml(ad.client)}" data-field="client" data-ad-id="${ad.id}" placeholder="会社名・団体名">
        </label>
        <label>
          訴求内容
          <input value="${escapeHtml(ad.appeal)}" data-field="appeal" data-ad-id="${ad.id}" placeholder="健康、相続、講座、寄付など">
        </label>
        <label class="full">
          OCR本文・広告文
          <textarea rows="3" data-field="ocrText" data-ad-id="${ad.id}" placeholder="OCR結果や広告本文を貼り付け">${escapeHtml(ad.ocrText)}</textarea>
        </label>
        <label class="full">
          メモ
          <textarea rows="2" data-field="memo" data-ad-id="${ad.id}" placeholder="担当者メモ、確認事項">${escapeHtml(ad.memo)}</textarea>
        </label>
      </div>
      <span class="helper-text">${escapeHtml(ad.reason || "未分析")}</span>
    </div>
  `;
}

function renderAnalysis() {
  const rows = collectAds().filter(ad => ad.date === state.selectedDate);
  if (!rows.length) {
    els.analysisTable.innerHTML = `<tr><td colspan="6">分析対象の広告枠がありません。</td></tr>`;
    els.alertBox.classList.remove("is-visible");
    els.alertBox.textContent = "";
    return;
  }

  const sorted = [...rows].sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict));
  els.analysisTable.innerHTML = sorted
    .map(ad => {
      const page = findPage(ad.pageId);
      return `
        <tr>
          <td><span class="verdict ${verdictClass(ad.verdict)}">${ad.verdict || "△"}</span></td>
          <td>${escapeHtml(ad.client || "未入力")}</td>
          <td>${escapeHtml(ad.industry || "未分類")}</td>
          <td>${escapeHtml(ad.appeal || summarizeText(ad.ocrText) || "未入力")}</td>
          <td>${escapeHtml(ad.pdfName)}<br>${page ? escapeHtml(page.faceName) : `${ad.pageNumber}面`} / ${escapeHtml(ad.slot)}</td>
          <td>${escapeHtml(ad.reason || "未分析")}</td>
        </tr>
      `;
    })
    .join("");

  const severe = rows.filter(ad => ad.verdict === "✕");
  const caution = rows.filter(ad => ad.verdict === "△");
  if (severe.length || caution.length) {
    els.alertBox.classList.add("is-visible");
    els.alertBox.textContent = `要確認: ✕ ${severe.length}件 / △ ${caution.length}件。登録メール宛の文面作成が可能です。`;
  } else {
    els.alertBox.classList.remove("is-visible");
    els.alertBox.textContent = "";
  }
}

function collectAds() {
  return state.papers.flatMap(paper =>
    paper.pages.flatMap(page =>
      page.ads.map(ad => ({
        ...ad,
        pdfName: paper.name,
        date: page.date,
        pageNumber: page.pageNumber
      }))
    )
  );
}

function selectedPapers() {
  return state.papers
    .map(paper => ({
      ...paper,
      pages: paper.pages.filter(page => page.date === state.selectedDate)
    }))
    .filter(paper => paper.pages.length);
}

function selectedPages() {
  return state.papers.flatMap(paper =>
    paper.pages
      .filter(page => page.date === state.selectedDate)
      .map(page => ({ ...page, paper }))
  );
}

function paperCountForDate(date) {
  return new Set(
    state.papers
      .filter(paper => paper.pages.some(page => page.date === date))
      .map(paper => paper.id)
  ).size;
}

function normalizeManifestEntry(item) {
  if (typeof item === "string") {
    return { name: item, paperDates: [] };
  }
  return {
    name: item.name,
    paperDates: item.paperDates || []
  };
}

function paperDateForPage(pageNumber, paperDates) {
  const match = paperDates.find(range => pageNumber >= range.from && pageNumber <= range.to);
  return match?.date || "";
}

function shiftMonth(month, amount) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function findPage(pageId) {
  for (const paper of state.papers) {
    const page = paper.pages.find(candidate => candidate.id === pageId);
    if (page) return page;
  }
  return null;
}

function findAd(adId) {
  for (const paper of state.papers) {
    for (const page of paper.pages) {
      const ad = page.ads.find(candidate => candidate.id === adId);
      if (ad) return ad;
    }
  }
  return null;
}

function inferIndustry(ad) {
  const text = normalizeText(`${ad.client} ${ad.appeal} ${ad.ocrText} ${ad.memo}`);
  const rules = [
    ["医療・健康", ["健康", "医療", "病院", "薬", "痛み", "サプリ", "介護", "検診"]],
    ["金融・保険", ["保険", "相続", "投資", "年金", "ローン", "銀行", "資産"]],
    ["教育", ["講座", "学校", "大学", "資格", "学習", "セミナー", "教材"]],
    ["出版", ["本", "書籍", "出版", "新聞", "雑誌"]],
    ["宗教・仏事", ["仏", "墓", "葬", "法要", "霊園", "仏壇"]],
    ["旅行・観光", ["旅行", "観光", "ホテル", "温泉", "ツアー"]],
    ["不動産・建設", ["住宅", "不動産", "建設", "リフォーム", "土地"]],
    ["通販", ["通販", "送料無料", "注文", "お申し込み", "販売"]],
    ["文化・イベント", ["公演", "コンサート", "映画", "展覧", "イベント"]],
    ["行政・団体", ["協会", "財団", "法人", "自治体", "省"]]
  ];
  const match = rules.find(([, words]) => words.some(word => text.includes(word)));
  return match ? match[0] : "未分類";
}

function inferAppeal(ad) {
  const text = normalizeText(`${ad.client} ${ad.appeal} ${ad.ocrText} ${ad.memo}`);
  const keywords = ["健康", "相続", "安心", "無料", "講座", "通販", "相談", "予防", "葬儀", "旅行", "出版", "寄付"];
  return keywords.filter(keyword => text.includes(keyword)).slice(0, 3).join("、");
}

function overlapKeywords(a, b) {
  const keywords = ["健康", "痛み", "相続", "保険", "相談", "無料", "寄付", "葬儀", "講座", "旅行", "出版", "通販", "安心"];
  return keywords.some(keyword => normalizeText(a).includes(keyword) && normalizeText(b).includes(keyword));
}

function computeContentHash(sourceCanvas) {
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const { data, width, height } = sourceData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let darkPixels = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
      if (brightness < 242) {
        darkPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!darkPixels) {
    return { hash: "", contentRatio: 0 };
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width, maxX + pad);
  maxY = Math.min(height, maxY + pad);

  const sampleSize = 16;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(sourceCanvas, minX, minY, maxX - minX, maxY - minY, 0, 0, sampleSize, sampleSize);
  const sample = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
  const gray = [];
  for (let i = 0; i < sample.length; i += 4) {
    gray.push((sample[i] + sample[i + 1] + sample[i + 2]) / 3);
  }
  const average = gray.reduce((sum, value) => sum + value, 0) / gray.length;
  const hash = gray.map(value => (value < average ? "1" : "0")).join("");
  const contentRatio = ((maxX - minX) * (maxY - minY)) / (width * height);
  return { hash, contentRatio };
}

function normalizePageCanvas(sourceCanvas) {
  if (sourceCanvas.height >= sourceCanvas.width) {
    return { canvas: sourceCanvas, rotation: 0, autoRotated: false };
  }
  return { canvas: rotateCanvas(sourceCanvas, -90), rotation: 270, autoRotated: true };
}

function rotateCanvas(sourceCanvas, degrees) {
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  if (normalizedDegrees === 0) return sourceCanvas;

  const targetCanvas = document.createElement("canvas");
  const quarterTurn = normalizedDegrees === 90 || normalizedDegrees === 270;
  targetCanvas.width = quarterTurn ? sourceCanvas.height : sourceCanvas.width;
  targetCanvas.height = quarterTurn ? sourceCanvas.width : sourceCanvas.height;

  const context = targetCanvas.getContext("2d", { willReadFrequently: true });
  context.translate(targetCanvas.width / 2, targetCanvas.height / 2);
  context.rotate((normalizedDegrees * Math.PI) / 180);
  context.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return targetCanvas;
}

async function rotatePageImage(pageId, degrees) {
  const page = findPage(pageId);
  if (!page) return;
  const image = await loadImage(page.thumbnail);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0);

  const rotated = rotateCanvas(canvas, degrees);
  const hashInfo = computeContentHash(rotated);
  page.thumbnail = rotated.toDataURL("image/jpeg", 0.82);
  page.hash = hashInfo.hash;
  page.contentRatio = hashInfo.contentRatio;
  page.rotation = ((page.rotation + degrees) % 360 + 360) % 360;
  page.autoRotated = false;
  page.orientation = rotated.height >= rotated.width ? "portrait" : "landscape";
  runAnalysis();
  renderAll();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function compareHashes(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) distance += 1;
  }
  return 1 - distance / a.length;
}

function compareText(a, b) {
  if (!a || !b || a.length < 4 || b.length < 4) return 0;
  const setA = new Set(makeBigrams(a));
  const setB = new Set(makeBigrams(b));
  const intersection = [...setA].filter(item => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function makeBigrams(text) {
  const clean = normalizeText(text);
  const grams = [];
  for (let i = 0; i < clean.length - 1; i += 1) {
    grams.push(clean.slice(i, i + 2));
  }
  return grams;
}

function prepareAlertMail() {
  const alerts = collectAds().filter(ad => ad.date === state.selectedDate && (ad.verdict === "✕" || ad.verdict === "△"));
  if (!alerts.length) {
    els.importStatus.textContent = "アラート対象はありません";
    return;
  }

  const body = buildAlertBody(alerts);
  if (!state.emails.length) {
    navigator.clipboard?.writeText(body);
    els.importStatus.textContent = "メール本文をコピーしました";
    return;
  }

  const subject = encodeURIComponent(`広告重複アラート ${state.selectedDate}`);
  const encodedBody = encodeURIComponent(body);
  window.location.href = `mailto:${state.emails.join(",")}?subject=${subject}&body=${encodedBody}`;
}

function buildAlertBody(alerts) {
  const lines = [
    `広告重複アラート`,
    `掲載日: ${state.selectedDate}`,
    "",
    ...alerts.map(ad => {
      const page = findPage(ad.pageId);
      return [
        `判定: ${ad.verdict}`,
        `PDF: ${ad.pdfName}`,
        `位置: ${page ? page.faceName : `${ad.pageNumber}面`} / ${ad.slot}`,
        `広告主: ${ad.client || "未入力"}`,
        `業種: ${ad.industry || "未分類"}`,
        `訴求: ${ad.appeal || summarizeText(ad.ocrText) || "未入力"}`,
        `理由: ${ad.reason || "未分析"}`
      ].join("\n");
    })
  ];
  return lines.join("\n\n");
}

async function copyCodexPrompt() {
  const papers = selectedPapers();
  const ads = collectAds().filter(ad => ad.date === state.selectedDate);
  const prompt = [
    "公明新聞の広告重複チェックをしてください。",
    `掲載日: ${state.selectedDate}`,
    "",
    "PDF:",
    ...papers.map(paper => `- ${paper.name}: ${paper.pageCount}ページ、日付${paper.dateConfirmed ? "確認済み" : "未確認"}`),
    "",
    "広告枠:",
    ...ads.map(ad => {
      const page = findPage(ad.pageId);
      return `- ${ad.verdict || "未判定"} ${ad.pdfName} ${page ? page.faceName : `${ad.pageNumber}面`} ${ad.slot} / 広告主=${ad.client || "未入力"} / 業種=${ad.industry || "未分類"} / 訴求=${ad.appeal || summarizeText(ad.ocrText) || "未入力"} / 理由=${ad.reason || "未分析"}`;
    }),
    "",
    "過去フィードバック:",
    ...(state.feedbacks.length ? state.feedbacks.slice(0, 8).map(item => `- ${item.text}`) : ["- なし"]),
    "",
    "依頼: 日付の妥当性、同日内の広告主・業種・訴求内容のかぶり、○△✕判定の過不足を確認してください。"
  ].join("\n");

  await navigator.clipboard?.writeText(prompt);
  els.importStatus.textContent = "Codex確認メモをコピーしました";
}

function setBusy(isBusy, text) {
  els.runtimeStatus.textContent = text;
  els.importStatus.textContent = text;
  els.loadFolderPdfs.disabled = isBusy;
  els.runAnalysis.disabled = isBusy;
}

function inferDateFromName(name) {
  const match = name.match(/(20\d{2})(\d{2})(\d{2})/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function summarizeText(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 34)}...` : clean;
}

function verdictClass(verdict) {
  if (verdict === "○") return "ok";
  if (verdict === "✕") return "bad";
  return "warn";
}

function verdictRank(verdict) {
  if (verdict === "✕") return 0;
  if (verdict === "△") return 1;
  return 2;
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function toMonthValue(date) {
  return toDateInputValue(date).slice(0, 7);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function loadStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
