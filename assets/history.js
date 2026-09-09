(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var stage = document.getElementById("hxStage");
  var chapters = Array.prototype.slice.call(document.querySelectorAll(".hx-chapter"));
  var progressEl = document.getElementById("hxProgress");
  var total = chapters.length;

  function kickerTextEls(ch) {
    return ch.querySelectorAll(".hx-kicker-mask > *, .hx-text-mask > *");
  }
  function photoBoxes(ch) {
    return Array.prototype.slice.call(ch.querySelectorAll(".hx-photo"));
  }
  function photoMask(box) {
    return box.querySelector(".hx-photo-mask");
  }
  function yearDigits(ch) {
    return ch.querySelectorAll(".hx-year-digit");
  }

  // ---- prime every chapter's rest/hidden state through GSAP itself ----
  // Three depth tiers, hidden three different ways so they can later
  // move at different rates: the year (background) rolls in per-digit
  // like an odometer, the photo (midground) reveals + comes forward
  // via scale, the text (foreground) mask-slides.
  chapters.forEach(function (ch, i) {
    gsap.set(kickerTextEls(ch), { yPercent: 130 });
    gsap.set(yearDigits(ch), { yPercent: 120 });
    photoBoxes(ch).forEach(function (box) {
      gsap.set(photoMask(box), { clipPath: "inset(100% 0 0 0)" });
      gsap.set(box, { scale: 1.18, transformOrigin: "50% 50%" });
    });
    if (i > 0) gsap.set(ch, { yPercent: 100 });
  });

  // ================= FIRST SCREEN =================
  // Chapter 1 reveals in place with the same three-tier depth timing
  // used by every later transition, so the opening screen already
  // reads as layered space rather than one flat card.
  var ch0 = chapters[0];
  var intro = gsap.timeline({ delay: 0.2 });

  intro.to(yearDigits(ch0), {
    yPercent: 0,
    duration: 1.1,
    ease: "power3.out",
    stagger: 0.08
  }, 0);

  photoBoxes(ch0).forEach(function (box, i) {
    intro.to(photoMask(box), {
      clipPath: "inset(0% 0 0 0)",
      duration: 1,
      ease: "power3.out"
    }, 0.15 + i * 0.1);
    intro.to(box, {
      scale: 1,
      duration: 1.1,
      ease: "power3.out"
    }, 0.15 + i * 0.1);
  });

  intro.to(kickerTextEls(ch0), {
    yPercent: 0,
    duration: 0.9,
    ease: "power4.out",
    stagger: 0.07
  }, 0.35);

  // Once the intro finishes, dispose of it entirely so it can never
  // fight the scroll-driven master timeline for control of the same
  // properties later (two independent GSAP animations targeting the
  // same property on the same element can otherwise leave a stale
  // render behind).
  intro.eventCallback("onComplete", function () {
    intro.kill();
  });

  // ================= TRANSITIONS =================
  // One long pinned scrub covering every chapter-to-chapter handoff.
  // Each handoff is one "unit" of the master timeline (chapter i's
  // segment runs from time i to i+1); scrub maps scroll position to
  // timeline progress, so scrolling up plays it in reverse.
  var segments = total - 1;
  var master = gsap.timeline({
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "+=" + segments * 100 + "%",
      scrub: true,
      pin: true,
      onUpdate: function (self) {
        var pct = Math.round(self.progress * 100);
        progressEl.textContent = "[" + (pct < 10 ? "0" + pct : pct) + "%]";
      }
    }
  });

  chapters.forEach(function (ch, i) {
    if (i === total - 1) return;
    var next = chapters[i + 1];
    var t = i; // this handoff occupies master-timeline time [i, i+1)

    // ---- outgoing chapter exits: nearest layer leaves fastest,
    // background layer (year) lingers longest ----
    master.fromTo(kickerTextEls(ch), { yPercent: 0 }, {
      yPercent: -130,
      duration: 0.45,
      ease: "power1.in"
    }, t);

    photoBoxes(ch).forEach(function (box, bi) {
      master.fromTo(photoMask(box), { clipPath: "inset(0% 0 0 0)" }, {
        clipPath: "inset(0% 0 100% 0)",
        duration: 0.7,
        ease: "none"
      }, t + 0.05 + bi * 0.04);
      // recedes: grows slightly larger as it leaves, as if drifting
      // toward the viewer and past the frame
      master.fromTo(box, { scale: 1 }, {
        scale: 1.12,
        duration: 0.7,
        ease: "none"
      }, t + 0.05 + bi * 0.04);
    });

    master.fromTo(yearDigits(ch), { yPercent: 0 }, {
      yPercent: -120,
      duration: 0.9,
      ease: "none",
      stagger: 0.08
    }, t);

    // ---- incoming chapter rises from below the viewport as a whole,
    // while its own layers settle at three different speeds ----
    master.fromTo(next, { yPercent: 100 }, {
      yPercent: 0,
      duration: 1,
      ease: "none"
    }, t);

    // year: furthest layer — digits roll up into place per-column,
    // like an odometer counting to the next chapter
    master.fromTo(yearDigits(next), { yPercent: 120 }, {
      yPercent: 0,
      duration: 0.8,
      ease: "none",
      stagger: 0.08
    }, t + 0.15);

    // photo: midground — reveals while coming forward from a larger
    // state down to its settled size
    photoBoxes(next).forEach(function (box, bi) {
      master.fromTo(photoMask(box), { clipPath: "inset(100% 0 0 0)" }, {
        clipPath: "inset(0% 0 0 0)",
        duration: 0.6,
        ease: "none"
      }, t + 0.1 + bi * 0.05);
      master.fromTo(box, { scale: 1.18 }, {
        scale: 1,
        duration: 0.6,
        ease: "none"
      }, t + 0.1 + bi * 0.05);
    });

    master.fromTo(kickerTextEls(next), { yPercent: 130 }, {
      yPercent: 0,
      duration: 0.45,
      ease: "none",
      stagger: 0.05
    }, t + 0.55);
  });
})();
