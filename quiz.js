// Listening-quiz renderer. Each page sets window.QUIZ before loading this file:
// { badge, title, instruction, audio, layout?: "row", questions: [{ text?, options: [], answer }] }
(function () {
  var Q = window.QUIZ;
  var LETTERS = "abcdefgh";
  var total = Q.questions.length;

  var ICONS = {
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    play: '<polygon points="7 4 20 12 7 20 7 4" fill="currentColor"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
    replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2z"/>',
    retry: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || "icon") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------- Shell ----------
  var app = document.getElementById("app");
  app.innerHTML =
    '<a class="back" href="index.html">' + icon("back", "icon-sm") + "Danh sách bài</a>" +
    '<header class="hero">' +
      '<span class="chip">' + icon("headphones", "icon-sm") + esc(Q.badge) + "</span>" +
      "<h1>" + esc(Q.title) + "</h1>" +
      "<p>" + esc(Q.instruction) + "</p>" +
    "</header>" +

    '<section class="player" aria-label="Trình phát audio">' +
      '<audio id="audio" preload="metadata" src="' + esc(Q.audio) + '"></audio>' +
      '<button class="pbtn play" id="play" type="button" aria-label="Phát audio">' + icon("play") + "</button>" +
      '<button class="pbtn back5" id="back5" type="button" aria-label="Lùi 5 giây" title="Lùi 5 giây">' + icon("replay") + "</button>" +
      '<div class="track">' +
        '<div class="track-top"><span id="cur">0:00</span><span id="dur">0:00</span></div>' +
        '<input class="seek" id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Vị trí audio">' +
      "</div>" +
      '<button class="speed" id="speed" type="button" aria-label="Tốc độ phát" title="Đổi tốc độ">1x</button>' +
    "</section>" +

    '<section class="result" id="result" aria-live="polite">' +
      '<div class="ring" id="ring">' +
        '<svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52" fill="none" stroke-width="12"/>' +
        '<circle class="fg" id="ringFg" cx="60" cy="60" r="52" fill="none" stroke-width="12" stroke-dasharray="326.73" stroke-dashoffset="326.73"/></svg>' +
        '<div class="ring-label"><b id="score">0</b><span>trên ' + total + " câu</span></div>" +
      "</div>" +
      "<div>" +
        '<h2 id="msg"></h2>' +
        '<p class="sub" id="sub"></p>' +
        '<div class="stats" id="stats"></div>' +
        '<div class="result-actions">' +
          '<button class="btn ghost" id="onlyWrong" type="button" aria-pressed="false">' + icon("filter", "icon-sm") + "Chỉ xem câu sai</button>" +
          '<button class="btn pink" id="retryTop" type="button">' + icon("retry", "icon-sm") + "Làm lại</button>" +
        "</div>" +
      "</div>" +
    "</section>" +

    '<section class="questions" id="questions" aria-label="Câu hỏi"></section>';

  var bar = document.createElement("div");
  bar.className = "bar";
  bar.innerHTML =
    '<div class="notice" id="notice" role="status"></div>' +
    '<div class="bar-inner">' +
      '<div class="prog">' +
        '<div class="prog-text" id="progText"></div>' +
        '<div class="prog-track"><div class="prog-fill" id="progFill"></div></div>' +
      "</div>" +
      '<button class="btn" id="submit" type="button">' + icon("send", "icon-sm") + "Nộp bài</button>" +
      '<button class="btn pink" id="retry" type="button" hidden>' + icon("retry", "icon-sm") + "Làm lại</button>" +
    "</div>";
  document.body.appendChild(bar);

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Audio player ----------
  var audio = $("audio"), playBtn = $("play"), seek = $("seek");
  var speeds = [1, 0.85, 0.75], speedIdx = 0, seeking = false;

  function fmt(t) {
    if (!isFinite(t)) return "0:00";
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function paintSeek() {
    var pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    if (!seeking) seek.value = Math.round(pct * 10);
    seek.style.setProperty("--pct", (seek.value / 10) + "%");
    $("cur").textContent = fmt(audio.currentTime);
  }
  function setPlayIcon() {
    var playing = !audio.paused;
    playBtn.innerHTML = icon(playing ? "pause" : "play");
    playBtn.setAttribute("aria-label", playing ? "Tạm dừng" : "Phát audio");
  }

  playBtn.addEventListener("click", function () { audio.paused ? audio.play() : audio.pause(); });
  $("back5").addEventListener("click", function () { audio.currentTime = Math.max(0, audio.currentTime - 5); });
  $("speed").addEventListener("click", function () {
    speedIdx = (speedIdx + 1) % speeds.length;
    audio.playbackRate = speeds[speedIdx];
    this.textContent = speeds[speedIdx] + "x";
  });
  audio.addEventListener("loadedmetadata", function () { $("dur").textContent = fmt(audio.duration); });
  audio.addEventListener("timeupdate", paintSeek);
  audio.addEventListener("play", setPlayIcon);
  audio.addEventListener("pause", setPlayIcon);
  audio.addEventListener("ended", setPlayIcon);
  seek.addEventListener("input", function () {
    seeking = true;
    seek.style.setProperty("--pct", (seek.value / 10) + "%");
    if (audio.duration) $("cur").textContent = fmt((seek.value / 1000) * audio.duration);
  });
  seek.addEventListener("change", function () {
    if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
    seeking = false;
  });

  // ---------- Quiz ----------
  var picks, submitted, confirmArmed;
  var list = $("questions"), notice = $("notice");

  function build() {
    picks = new Array(total).fill(null);
    submitted = false;
    confirmArmed = false;
    list.innerHTML = "";

    Q.questions.forEach(function (q, qi) {
      var box = document.createElement("article");
      box.className = "q";
      box.id = "q" + qi;
      box.style.setProperty("--i", qi);

      var textHtml = q.text
        ? '<p class="q-text">' + esc(q.text).replace("___", '<span class="blank"></span>') + "</p>"
        : '<p class="q-text dim">Người nói dùng tên nào?</p>';

      var opts = q.options.map(function (label, oi) {
        return '<button type="button" class="opt" data-q="' + qi + '" data-o="' + oi + '" aria-pressed="false">' +
          '<span class="letter">' + LETTERS[oi] + "</span>" +
          '<span class="opt-label">' + esc(label) + "</span>" +
          '<span class="mark"></span></button>';
      }).join("");

      box.innerHTML =
        '<div class="q-head"><span class="q-num" aria-label="Câu ' + (qi + 1) + '">' + (qi + 1) + "</span>" + textHtml + "</div>" +
        '<div class="opts' + (Q.layout === "row" ? " row" : "") + '" role="group" aria-label="Đáp án câu ' + (qi + 1) + '">' + opts + "</div>" +
        '<p class="verdict" hidden></p>';
      list.appendChild(box);
    });

    $("result").classList.remove("show");
    $("submit").hidden = false;
    $("retry").hidden = true;
    notice.classList.remove("show");
    setOnlyWrong(false);
    updateProgress();
  }

  list.addEventListener("click", function (e) {
    var b = e.target.closest(".opt");
    if (!b || submitted) return;
    var qi = +b.dataset.q, oi = +b.dataset.o;
    picks[qi] = oi;
    var box = $("q" + qi);
    box.classList.add("answered");
    box.classList.remove("flag");
    box.querySelectorAll(".opt").forEach(function (o, i) {
      o.classList.toggle("selected", i === oi);
      o.setAttribute("aria-pressed", i === oi ? "true" : "false");
    });
    notice.classList.remove("show");
    confirmArmed = false;
    updateProgress();
  });

  function answered() { return picks.filter(function (p) { return p !== null; }).length; }

  function updateProgress() {
    var n = answered();
    $("progText").innerHTML = submitted
      ? "Đã nộp bài"
      : "Đã làm <b>" + n + "/" + total + "</b> câu";
    $("progFill").style.width = (submitted ? 100 : (n / total) * 100) + "%";
    $("submit").classList.toggle("locked", !submitted && n < total);
    $("submit").setAttribute("aria-disabled", !submitted && n < total ? "true" : "false");
  }

  $("submit").addEventListener("click", function () {
    var missing = [];
    picks.forEach(function (p, i) { if (p === null) missing.push(i); });
    if (missing.length) {
      missing.forEach(function (i) {
        var el = $("q" + i);
        el.classList.remove("flag");
        void el.offsetWidth;
        el.classList.add("flag");
      });
      notice.textContent = "Em cần chọn đáp án cho tất cả các câu mới nộp được bài. Còn " + missing.length + " câu chưa chọn (viền vàng).";
      notice.classList.add("show");
      $("q" + missing[0]).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    grade();
  });

  function grade() {
    submitted = true;
    notice.classList.remove("show");
    var correct = 0;

    Q.questions.forEach(function (q, qi) {
      var box = $("q" + qi), pick = picks[qi], ok = pick === q.answer;
      if (ok) correct++;
      box.classList.remove("flag");
      box.classList.add(ok ? "right" : "wrong");
      box.querySelectorAll(".opt").forEach(function (b, i) {
        b.disabled = true;
        b.classList.remove("selected");
        var mark = b.querySelector(".mark");
        if (i === q.answer) { b.classList.add("is-correct"); mark.innerHTML = icon("check", "icon-sm"); }
        if (i === pick && !ok) { b.classList.add("is-wrong"); mark.innerHTML = icon("x", "icon-sm"); }
      });
      var v = box.querySelector(".verdict");
      v.hidden = false;
      v.className = "verdict " + (ok ? "right" : "wrong");
      var right = LETTERS[q.answer] + ". " + q.options[q.answer];
      v.innerHTML = ok
        ? icon("check", "icon-sm") + "Chính xác"
        : icon("x", "icon-sm") + esc((pick === null ? "Chưa chọn" : "Chưa đúng") + " — đáp án: " + right);
    });

    var ratio = correct / total;
    var ten = Math.round(ratio * 100) / 10;
    var wrong = total - correct;

    $("score").textContent = correct;
    var ring = $("ring");
    ring.classList.toggle("great", ratio >= 0.75);
    ring.classList.toggle("low", ratio < 0.5);
    $("ringFg").style.strokeDashoffset = 326.73;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { $("ringFg").style.strokeDashoffset = 326.73 * (1 - ratio); });
    });

    var msg, sub;
    if (ratio === 1) { msg = "Xuất sắc! Đúng hết rồi"; sub = "Em nghe rất tốt, giữ vững phong độ nhé."; }
    else if (ratio >= 0.75) { msg = "Giỏi lắm!"; sub = "Xem lại câu sai bên dưới để hiểu vì sao nhé."; }
    else if (ratio >= 0.5) { msg = "Khá tốt, cố thêm chút nữa"; sub = "Nghe lại đoạn audio và đối chiếu câu sai bên dưới."; }
    else { msg = "Mình nghe lại lần nữa nhé"; sub = "Câu sai được tô đỏ, đáp án đúng tô xanh."; }
    $("msg").textContent = msg;
    $("sub").textContent = sub;
    $("stats").innerHTML =
      '<span class="stat ok">' + icon("check", "icon-sm") + correct + " đúng</span>" +
      '<span class="stat bad">' + icon("x", "icon-sm") + wrong + " sai</span>" +
      '<span class="stat ten">Điểm: ' + ten + "/10</span>";
    $("onlyWrong").hidden = wrong === 0;

    $("result").classList.add("show");
    $("submit").hidden = true;
    $("retry").hidden = false;
    updateProgress();
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setOnlyWrong(on) {
    $("onlyWrong").setAttribute("aria-pressed", on ? "true" : "false");
    list.querySelectorAll(".q").forEach(function (q) {
      q.classList.toggle("hide", on && q.classList.contains("right"));
    });
  }
  $("onlyWrong").addEventListener("click", function () {
    setOnlyWrong(this.getAttribute("aria-pressed") !== "true");
  });

  function retry() {
    audio.pause();
    audio.currentTime = 0;
    build();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("retry").addEventListener("click", retry);
  $("retryTop").addEventListener("click", retry);

  build();
})();
