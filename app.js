import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const STORAGE = {
  feedbacks: "ad-checker-feedbacks",
  emails: "ad-checker-emails",
  sidebarWidths: "ad-checker-sidebar-widths"
};

const LOCAL_PREVIEW_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:4173/"
    : `${window.location.origin}/`;

const industryOptions = [
  "未分類",
  "医療・健康",
  "金融・保険",
  "教育",
  "出版",
  "製紙・紙業",
  "宗教・仏事",
  "旅行・観光",
  "不動産・建設",
  "通販",
  "生活サービス",
  "文化・イベント",
  "行政・団体",
  "その他"
];

const spreadDefinitions = [
  { label: "1", faces: ["1面", null] },
  { label: "2&3", faces: ["2面", "3面"] },
  { label: "4&5", faces: ["4面", "5面"] },
  { label: "6&7", faces: ["6面", "7面"] },
  { label: "ラテ", faces: ["ラテ面", null] }
];

const state = {
  papers: [],
  feedbacks: loadStorage(STORAGE.feedbacks, []),
  emails: loadStorage(STORAGE.emails, []),
  dateReviews: [],
  allocationSource: null,
  allocationReferences: [],
  showPageEditors: false,
  showControlSidebar: true,
  showPaperSidebar: true,
  sidebarWidths: loadStorage(STORAGE.sidebarWidths, { control: 288, paper: 410 }),
  selectedDate: toDateInputValue(new Date()),
  selectedMonth: toMonthValue(new Date()),
  confirmedDate: false,
  latestAnalysis: []
};

const els = {
  runtimeStatus: document.querySelector("#runtimeStatus"),
  appShell: document.querySelector("#appShell"),
  controlSidebar: document.querySelector("#controlSidebar"),
  paperSidebar: document.querySelector("#paperSidebar"),
  sidebarResizers: document.querySelectorAll("[data-resize-sidebar]"),
  toggleControlSidebar: document.querySelector("#toggleControlSidebar"),
  togglePaperSidebar: document.querySelector("#togglePaperSidebar"),
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
  allocationReferenceList: document.querySelector("#allocationReferenceList"),
  pagesGrid: document.querySelector("#pagesGrid"),
  codexReviewPanel: document.querySelector("#codexReviewPanel"),
  togglePageEditors: document.querySelector("#togglePageEditors"),
  runAnalysis: document.querySelector("#runAnalysis"),
  alertBox: document.querySelector("#alertBox"),
  analysisTable: document.querySelector("#analysisTable")
};

init();

function init() {
  els.localUrl.textContent = LOCAL_PREVIEW_URL;
  els.publicationDate.value = state.selectedDate;
  applySidebarWidths();
  bindEvents();
  updateSidebarVisibility();
  renderAll();
  loadSeedData();
}

function bindEvents() {
  els.toggleControlSidebar.addEventListener("click", toggleControlSidebar);
  els.togglePaperSidebar.addEventListener("click", togglePaperSidebar);
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
  els.togglePageEditors.addEventListener("click", togglePageEditors);
  bindSidebarResizers();

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

  removeSeedData();
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
  removeSeedData();
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

async function loadSeedData() {
  if (state.papers.length) return;
  try {
    const response = await fetch("./seed-data.json", { cache: "no-store" });
    if (!response.ok) return;
    const seed = await response.json();
    state.allocationSource = seed.allocationSource || null;
    state.allocationReferences = seed.allocationReferences || [];
    const papers = (seed.papers || []).map(createSeedPaper);
    if (!papers.length) return;
    state.papers.push(...papers);
    state.dateReviews = seed.dateReviews || [];
    const dates = papers.flatMap(paper => paper.pages.map(page => page.date)).sort();
    state.selectedDate = dates.at(-1) || state.selectedDate;
    state.selectedMonth = state.selectedDate.slice(0, 7);
    els.publicationDate.value = state.selectedDate;
    setBusy(false, "読み取り済みPDFデータを表示中");
    runAnalysis();
    renderAll();
  } catch {
    // 初期データは補助表示なので、読めなくても通常利用を継続する。
  }
}

function createSeedPaper(seedPaper) {
  const paper = {
    id: makeId("seed-paper"),
    name: seedPaper.name,
    date: seedPaper.pages?.[0]?.date || state.selectedDate,
    dateConfirmed: true,
    source: "seed",
    importedAt: new Date().toISOString(),
    pageCount: seedPaper.pageCount || seedPaper.pages?.length || 0,
    pages: []
  };

  paper.pages = (seedPaper.pages || []).map(seedPage => createSeedPage(paper, seedPage));
  return paper;
}

function createSeedPage(paper, seedPage) {
  const page = {
    id: makeId("seed-page"),
    paperId: paper.id,
    pdfName: paper.name,
    date: seedPage.date,
    dateConfirmed: true,
    pageNumber: seedPage.pageNumber,
    faceName: seedPage.faceName || `${seedPage.pageNumber}面`,
    isLate: Boolean(seedPage.isLate),
    rotation: 0,
    autoRotated: false,
    orientation: "portrait",
    thumbnail: seedPage.image || seedImagePath(paper.name, seedPage.pageNumber),
    hash: "",
    contentRatio: seedPage.contentRatio ?? 1,
    ads: []
  };

  const adDefinitions = seedPage.ads || (seedPage.slots || ["記事下メイン"]).map(slot => ({ slot }));
  page.ads = adDefinitions.map(definition => createSeedAd(page, definition));
  return page;
}

function createSeedAd(page, definition) {
  const adDefinition = typeof definition === "string" ? { slot: definition } : definition;
  const ad = createAd(page, adDefinition.slot || "記事下メイン");
  ad.client = adDefinition.client || "";
  ad.appeal = adDefinition.appeal || inferAllocationAppeal(adDefinition);
  ad.allocationName = adDefinition.allocationName || "";
  ad.allocationNote = adDefinition.note || "";
  ad.possibleAgencyName = Boolean(adDefinition.possibleAgencyName);
  ad.memo = allocationMemo(adDefinition);
  ad.industry = adDefinition.industry || (ad.client || ad.appeal || ad.memo ? inferIndustry(ad) : "未分類");
  ad.verdict = "△";
  ad.reason = ad.client
    ? "割付表を参考に広告主候補を補完。代理店名の可能性があるため最終確認が必要"
    : "PDFから紙面日付と広告枠を読み取り済み。広告主・訴求内容はOCRまたは担当者入力で確認";
  return ad;
}

function inferAllocationAppeal(definition) {
  const text = normalizeText(`${definition.client || ""} ${definition.allocationName || ""} ${definition.note || ""}`);
  if (/製紙|紙パルプ|紙業|パルプ/.test(text)) return "製紙・紙業";
  if (/公明|写真で読む|グラフ|党出版物|月刊|潮|中央公論|書店|出版/.test(text)) return "出版・公明関連資料";
  if (/gサーチ|gsearch|電子版/.test(text)) return "記事検索・電子版";
  if (/イクハク|子育|子ども|こども|kids|unhcr|支援/.test(text)) return "子育て・支援";
  if (/建設|工業社|冷熱|熱学|熱工業|関電工|トーエネック|ユアテック|エンジニア|電工|設備/.test(text)) return "建設・設備";
  if (/夢g|フローラ|ヤマダ|がくぶん|通販|健康食品|高圧洗浄機/.test(text)) return "通販・直販";
  return "";
}

function allocationMemo(definition) {
  if (!definition.source && !definition.allocationName && !definition.note && !definition.possibleAgencyName) return "";
  const parts = ["割付表参考"];
  if (definition.allocationName && definition.client && definition.allocationName !== definition.client) {
    parts.push(`割付名: ${definition.allocationName}`);
  }
  if (definition.possibleAgencyName) {
    parts.push("代理店名の可能性あり");
  }
  if (definition.note) {
    parts.push(`補足: ${definition.note}`);
  }
  return parts.join(" / ");
}

function seedImagePath(fileName, pageNumber) {
  const stem = fileName.replace(/\.pdf$/i, "");
  return `./sample-pages/${encodeURIComponent(stem)}_p${pageNumber}.jpg`;
}

function createSeedThumbnail(fileName, seedPage) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 594;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f7f8fa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#c8d2df";
  context.lineWidth = 2;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.fillStyle = "#1d2733";
  context.font = "bold 24px sans-serif";
  context.fillText("読み取り済みデータ", 38, 72);
  context.font = "16px sans-serif";
  wrapCanvasText(context, fileName, 38, 122, 340, 24);
  context.font = "bold 20px sans-serif";
  context.fillText(`紙面日付 ${seedPage.date}`, 38, 218);
  context.fillText(`${seedPage.faceName || `${seedPage.pageNumber}面`} / PDF ${seedPage.pageNumber}ページ`, 38, 256);
  context.fillStyle = "#667085";
  context.font = "14px sans-serif";
  wrapCanvasText(context, "公開版ではPDF本体と紙面画像を同梱していません。紙面から読み取った構造データだけを表示しています。", 38, 326, 340, 22);
  return canvas.toDataURL("image/png");
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const characters = String(text).split("");
  let line = "";
  let currentY = y;
  for (const character of characters) {
    const testLine = `${line}${character}`;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = character;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) context.fillText(line, x, currentY);
}

function removeSeedData() {
  if (!state.papers.some(paper => paper.source === "seed")) return;
  state.papers = state.papers.filter(paper => paper.source !== "seed");
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

function togglePageEditors() {
  state.showPageEditors = !state.showPageEditors;
  renderPages();
}

function toggleControlSidebar() {
  state.showControlSidebar = !state.showControlSidebar;
  updateSidebarVisibility();
}

function togglePaperSidebar() {
  state.showPaperSidebar = !state.showPaperSidebar;
  updateSidebarVisibility();
}

function updateSidebarVisibility() {
  document.body.classList.toggle("control-sidebar-hidden", !state.showControlSidebar);
  document.body.classList.toggle("paper-sidebar-hidden", !state.showPaperSidebar);
  els.toggleControlSidebar.setAttribute("aria-expanded", String(state.showControlSidebar));
  els.togglePaperSidebar.setAttribute("aria-expanded", String(state.showPaperSidebar));
  els.toggleControlSidebar.textContent = state.showControlSidebar ? "操作を隠す" : "操作";
  els.togglePaperSidebar.textContent = state.showPaperSidebar ? "紙面を隠す" : "紙面";
}

function bindSidebarResizers() {
  els.sidebarResizers.forEach(handle => {
    handle.addEventListener("pointerdown", startSidebarResize);
    handle.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const target = handle.dataset.resizeSidebar;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const multiplier = target === "paper" ? -1 : 1;
      setSidebarWidth(target, (state.sidebarWidths[target] || defaultSidebarWidth(target)) + direction * multiplier * 16);
    });
  });
}

function startSidebarResize(event) {
  event.preventDefault();
  const target = event.currentTarget.dataset.resizeSidebar;
  const sidebar = target === "paper" ? els.paperSidebar : els.controlSidebar;
  const startX = event.clientX;
  const startWidth = sidebar.getBoundingClientRect().width;
  document.body.classList.add("is-resizing-sidebar");

  const onMove = moveEvent => {
    const delta = moveEvent.clientX - startX;
    const width = target === "paper" ? startWidth - delta : startWidth + delta;
    setSidebarWidth(target, width, false);
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing-sidebar");
    saveStorage(STORAGE.sidebarWidths, state.sidebarWidths);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function applySidebarWidths() {
  setSidebarWidth("control", state.sidebarWidths.control || 288, false);
  setSidebarWidth("paper", state.sidebarWidths.paper || 410, false);
}

function setSidebarWidth(target, width, persist = true) {
  const clamped = clamp(width, target === "paper" ? 320 : 240, target === "paper" ? 760 : 520);
  state.sidebarWidths[target] = clamped;
  document.documentElement.style.setProperty(`--${target}-sidebar-width`, `${clamped}px`);
  if (persist) saveStorage(STORAGE.sidebarWidths, state.sidebarWidths);
}

function defaultSidebarWidth(target) {
  return target === "paper" ? 410 : 288;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
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
  renderCodexReview();
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
  renderCodexReview();
  renderPages();
  renderAnalysis();
}

function renderCodexReview() {
  const review = state.dateReviews.find(item => item.date === state.selectedDate);
  const ads = collectAds().filter(ad => ad.date === state.selectedDate);
  const comparisonSource = ads.length ? ads : selectedAllocationReferences().map(allocationReferenceToAd);
  const comparisonItems = buildComparisonItems(review, comparisonSource);
  if (!review && !comparisonItems.length) {
    els.codexReviewPanel.innerHTML = `
      <div class="empty-state">この日付のCodex重複判定はまだありません。PDFを確認後、判定結果をここに追加します。</div>
    `;
    return;
  }

  els.codexReviewPanel.innerHTML = `
    <div class="review-summary">
      <div class="review-summary-main">
        <span class="verdict ${verdictClass(review?.verdict || "△")}">${review?.verdict || "△"}</span>
        <div>
          <h3>${escapeHtml(review?.title || "割付表参考による候補チェック")}</h3>
          <p>${escapeHtml(review?.summary || "PDF未登録または目視前の日付でも、割付表の広告主候補から近い業種・訴求の組み合わせを参考表示します。")}</p>
        </div>
      </div>
      <div class="comparison-list">
        ${comparisonItems.length ? comparisonItems.map(renderComparisonItem).join("") : `<div class="empty-state compact-empty">明確な比較候補はありません。</div>`}
      </div>
      <div class="review-meta">
        ${(review?.stats || []).map(item => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="review-finding-list">
        ${(review?.findings || []).map(finding => `
          <article class="review-finding">
            <div class="review-finding-title">
              <span class="verdict ${verdictClass(finding.verdict)}">${finding.verdict}</span>
              <span>${escapeHtml(finding.title)}</span>
            </div>
            <p>${escapeHtml(finding.reason)}</p>
            <span class="helper-text">${escapeHtml(finding.action)}</span>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderComparisonItem(item) {
  return `
    <article class="comparison-item">
      <span class="comparison-bullet">●</span>
      <span class="verdict ${verdictClass(item.verdict)}">${item.verdict}</span>
      <div>
        <h3>${escapeHtml(formatComparisonTitle(item))}</h3>
        <p>${escapeHtml(item.reason)}</p>
      </div>
    </article>
  `;
}

function formatComparisonTitle(item) {
  const a = item.a || {};
  const b = item.b || {};
  return `${item.date || state.selectedDate} ${a.faceName || ""} ${a.client || "クライアントA"}、同日付 ${b.faceName || ""} ${b.client || "クライアントB"}`;
}

function buildComparisonItems(review, ads) {
  const explicit = (review?.comparisons || []).map(item => ({
    verdict: item.verdict || review?.verdict || "△",
    date: item.date || state.selectedDate,
    a: item.a || {},
    b: item.b || {},
    reason: item.reason || item.theme || review?.summary || "要確認"
  }));
  if (explicit.length) return explicit;
  return buildGeneratedComparisons(ads);
}

function buildGeneratedComparisons(ads) {
  const groups = new Map();
  for (const ad of ads) {
    const theme = comparisonTheme(ad);
    if (!theme) continue;
    if (!groups.has(theme.key)) groups.set(theme.key, { ...theme, ads: [] });
    groups.get(theme.key).ads.push(ad);
  }

  const items = [];
  for (const group of groups.values()) {
    const unique = group.ads.filter((ad, index, list) =>
      list.findIndex(candidate => candidate.client === ad.client && candidate.pageId === ad.pageId) === index
    );
    if (unique.length < 2) continue;
    for (let index = 0; index < unique.length - 1 && items.length < 8; index += 1) {
      const a = unique[index];
      const b = unique[index + 1];
      items.push({
        verdict: "△",
        date: state.selectedDate,
        a: comparisonEndpoint(a),
        b: comparisonEndpoint(b),
        reason: `${group.label}。割付表は参考情報なので、広告主名と紙面上の実広告を目視確認してください。`
      });
    }
  }
  return items;
}

function comparisonEndpoint(ad) {
  const page = findPage(ad.pageId);
  return {
    faceName: page?.faceName || ad.faceName || `${ad.pageNumber}面`,
    client: ad.client || ad.allocationName || "広告主未入力"
  };
}

function allocationReferenceToAd(reference, index) {
  const ad = {
    id: `allocation-${index}`,
    pageId: "",
    paperId: "",
    pdfName: reference.source || "割付表",
    date: reference.date,
    pageNumber: 0,
    faceName: reference.faceName,
    slot: reference.slot,
    client: reference.client || "",
    allocationName: reference.allocationName || "",
    appeal: reference.appeal || "",
    memo: `${reference.note || ""} ${reference.possibleAgencyName ? "代理店名の可能性あり" : ""}`.trim(),
    industry: "未分類",
    ocrText: ""
  };
  ad.appeal = ad.appeal || inferAllocationAppeal(reference);
  ad.industry = inferIndustry(ad);
  return ad;
}

function comparisonTheme(ad) {
  const text = normalizeText(`${ad.client} ${ad.allocationName || ""} ${ad.industry} ${ad.appeal} ${ad.memo}`);
  if (/製紙|紙パルプ|紙業|パルプ/.test(text)) return { key: "paper", label: "似たような製紙会社・紙業系の広告が近い日付内にあります" };
  if (/公明|写真で読む|グラフ|党出版物|月刊|潮|中央公論|書店|出版|電子版|gサーチ|gsearch/.test(text)) return { key: "publishing", label: "公明関連・出版・記事検索系の訴求が近い組み合わせです" };
  if (/イクハク|子育|子ども|こども|kids|unhcr|支援/.test(text)) return { key: "children", label: "子育て・子ども支援テーマが近い組み合わせです" };
  if (/建設|工業社|冷熱|熱学|熱工業|関電工|トーエネック|ユアテック|エンジニア|電工|設備/.test(text)) return { key: "construction", label: "建設・設備・エンジニアリング系の広告が近い組み合わせです" };
  if (/夢g|フローラ|ヤマダ|がくぶん|通販|健康食品|高圧洗浄機/.test(text)) return { key: "retail", label: "通販・直販系の広告が近い組み合わせです" };
  return null;
}

function renderFeedbackHistory() {
  if (!state.feedbacks.length) {
    els.feedbackHistory.innerHTML = `<div class="history-item"><span class="helper-text">目視フィードバックはまだありません。</span></div>`;
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
    const allocationCount = allocationCountForDate(dateValue);
    const classes = [
      "calendar-day",
      inMonth ? "" : "is-outside",
      dateValue === today ? "is-today" : "",
      dateValue === state.selectedDate ? "is-active" : "",
      count ? "has-pdf" : "",
      allocationCount ? "has-allocation" : ""
    ].filter(Boolean).join(" ");
    const countLabel = count ? `${count}PDF` : allocationCount ? `${allocationCount}枠` : "PDFなし";

    return `
      <button class="${classes}" type="button" data-date="${dateValue}" aria-label="${dateValue} ${count ? `${count}件のPDF` : allocationCount ? `${allocationCount}件の割付参考` : "PDFなし"}">
        <span class="calendar-day-number">${date.getDate()}</span>
        <span class="calendar-day-count">${countLabel}</span>
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
  renderAllocationReferences();

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

function renderAllocationReferences() {
  const references = selectedAllocationReferences();
  if (!references.length) {
    els.allocationReferenceList.innerHTML = `<div class="allocation-empty">この日の割付表参考はありません。</div>`;
    return;
  }

  els.allocationReferenceList.innerHTML = references
    .map(reference => `
      <div class="allocation-item">
        <div class="allocation-line">
          <strong>${escapeHtml(reference.client || reference.allocationName || "未入力")}</strong>
          <span>${escapeHtml(reference.faceName)} / ${escapeHtml(reference.slot)}</span>
        </div>
        ${reference.allocationName && reference.allocationName !== reference.client ? `<span class="helper-text">割付名: ${escapeHtml(reference.allocationName)}</span>` : ""}
        ${reference.note ? `<span class="helper-text">補足: ${escapeHtml(reference.note)}</span>` : ""}
        ${reference.possibleAgencyName ? `<span class="tag caution-tag">代理店名の可能性</span>` : ""}
      </div>
    `)
    .join("");
}

function renderPages() {
  const pages = selectedPages();
  updatePageEditorToggle(pages.length);
  if (!pages.length) {
    els.pagesGrid.innerHTML = `<div class="empty-state">この日付のPDFページはまだありません。</div>`;
    return;
  }

  els.pagesGrid.innerHTML = spreadDefinitions
    .map(group => {
      const slotPages = group.faces.map(face => face ? pages.find(page => page.faceName === face) || null : null);
      const pageCount = slotPages.filter(Boolean).length;

      return `
        <section class="spread-group">
          <div class="spread-heading">
            <h3>${escapeHtml(group.label)}</h3>
            <span>${pageCount ? `${pageCount}面` : "未登録"}</span>
          </div>
          <div class="spread-pages">
            ${slotPages.map((page, index) => renderSpreadSlot(page, group.faces[index])).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderSpreadSlot(page, face) {
  if (page) return renderPagePreview(page);
  if (!face) return `<div class="spread-blank" aria-hidden="true"></div>`;
  return `
    <div class="spread-empty">
      <span>${escapeHtml(face)}</span>
      <small>未登録</small>
    </div>
  `;
}

function renderPagePreview(page) {
  return `
    <article class="page-card paper-preview-card">
      <img class="page-thumb ${page.orientation === "portrait" ? "is-portrait" : ""}" src="${page.thumbnail}" alt="${escapeHtml(page.pdfName)} ${page.pageNumber}ページ">
      <div class="page-compact-body">
        <div class="page-title-row">
          <div>
            <h3>${escapeHtml(page.faceName)}</h3>
            <span class="helper-text">${page.pageNumber}ページ / ${page.date}</span>
          </div>
          <span class="tag">${page.ads.length}枠</span>
        </div>
        <div class="page-ad-summary">
          ${page.ads.map(ad => `
            <span class="ad-chip">
              ${escapeHtml(ad.client || ad.allocationName || "広告主未入力")}
              <small>${escapeHtml(ad.appeal || ad.slot || "")}</small>
            </span>
          `).join("")}
        </div>
        ${state.showPageEditors ? renderPageEditorPanel(page) : ""}
      </div>
    </article>
  `;
}

function renderPageEditorPanel(page) {
  return `
    <div class="page-editor-panel">
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
  `;
}

function updatePageEditorToggle(pageCount) {
  if (!els.togglePageEditors) return;
  els.togglePageEditors.disabled = pageCount === 0;
  els.togglePageEditors.setAttribute("aria-expanded", String(state.showPageEditors));
  els.togglePageEditors.textContent = state.showPageEditors ? "入力欄を隠す" : "入力欄を表示";
}

function renderAdEditor(ad, page) {
  return `
    <div class="ad-editor">
      <div class="ad-toolbar">
        <span class="verdict ${verdictClass(ad.verdict)}">${ad.verdict || "△"}</span>
        <button class="small-button" type="button" data-ocr-ad="${ad.id}" data-page-id="${page.id}">OCR</button>
        <button class="small-button" type="button" data-remove-ad="${ad.id}" data-page-id="${page.id}">削除</button>
      </div>
      ${renderAllocationNote(ad)}
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

function renderAllocationNote(ad) {
  if (!ad.allocationName && !ad.allocationNote && !ad.possibleAgencyName) return "";
  return `
    <div class="allocation-note">
      <span class="tag">割付表参考</span>
      ${ad.allocationName && ad.allocationName !== ad.client ? `<span>割付名: ${escapeHtml(ad.allocationName)}</span>` : ""}
      ${ad.allocationNote ? `<span>補足: ${escapeHtml(ad.allocationNote)}</span>` : ""}
      ${ad.possibleAgencyName ? `<span class="tag caution-tag">代理店名の可能性</span>` : ""}
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

function selectedAllocationReferences() {
  return state.allocationReferences
    .filter(reference => reference.date === state.selectedDate)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function allocationCountForDate(date) {
  return state.allocationReferences.filter(reference => reference.date === date).length;
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
    ["製紙・紙業", ["製紙", "紙パルプ", "紙業", "パルプ", "紙"]],
    ["宗教・仏事", ["仏", "墓", "葬", "法要", "霊園", "仏壇"]],
    ["旅行・観光", ["旅行", "観光", "ホテル", "温泉", "ツアー"]],
    ["不動産・建設", ["住宅", "不動産", "建設", "リフォーム", "土地", "工業社", "冷熱", "熱学", "熱工業", "電工", "設備", "エンジニア"]],
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
    "過去目視フィードバック:",
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
