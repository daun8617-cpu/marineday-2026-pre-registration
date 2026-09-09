(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var stage = document.getElementById("cdStage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".cd-slide"));
  var progressEl = document.getElementById("cdProgress");
  var total = slides.length;

  // Photo & year live on the Z-depth (3D) system; text lives on a
  // separate Y-axis mask system so it reads as a clean vertical
  // reveal/exit instead of flying through 3D space with the photo.
  var DEPTH = {
    photo: 1000,
    year: 260
  };
  var TEXT_TRAVEL = 130; // % of its own box, mask-style

  function photosOf(slide) {
    return Array.prototype.slice.call(slide.querySelectorAll(".cd-photo"));
  }
  function textOf(slide) {
    return slide.querySelector(".cd-text");
  }
  function yearOf(slide) {
    return slide.querySelector(".cd-year");
  }

  // ---- prime every slide's rest/hidden state ----
  slides.forEach(function (slide, i) {
    var far = i > 0;
    var sign = far ? -1 : 1;

    photosOf(slide).forEach(function (p) {
      gsap.set(p, {
        z: far ? sign * DEPTH.photo : 0,
        opacity: far ? 0 : 1,
        rotationY: far ? sign * -6 : 0
      });
    });

    var t = textOf(slide);
    if (t) {
      gsap.set(t.children, {
        yPercent: far ? TEXT_TRAVEL : 0,
        opacity: far ? 0 : 1
      });
    }

    gsap.set(yearOf(slide), {
      z: far ? sign * DEPTH.year : 0,
      opacity: far ? 0 : 1
    });
  });

  // ================= scroll-synced depth transitions =================
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

  slides.forEach(function (slide, i) {
    if (i === total - 1) return;
    var next = slides[i + 1];
    var t = i;

    // ---- outgoing photo: drives forward through the camera. Opacity
    // is held high through most of the move (power4.in) so the growth
    // toward the viewer is clearly visible before it vanishes right at
    // the pass-through point, instead of fading evenly the whole way. ----
    photosOf(slide).forEach(function (p, pi) {
      master.fromTo(p, { z: 0 }, {
        z: DEPTH.photo,
        duration: 1,
        ease: "power1.in"
      }, t + pi * 0.03);
      master.fromTo(p, { opacity: 1 }, {
        opacity: 0,
        duration: 1,
        ease: "power4.in"
      }, t + pi * 0.03);
    });

    // ---- outgoing text: straight vertical mask exit, rising up and
    // fading — independent of the photo's 3D travel ----
    var outText = textOf(slide);
    if (outText) {
      master.fromTo(outText.children, { yPercent: 0, opacity: 1 }, {
        yPercent: -TEXT_TRAVEL,
        opacity: 0,
        duration: 0.8,
        ease: "power1.in",
        stagger: 0.04
      }, t);
    }

    master.fromTo(yearOf(slide), { z: 0, opacity: 1 }, {
      z: DEPTH.year,
      opacity: 0,
      duration: 1,
      ease: "power1.in"
    }, t);

    // ---- incoming photo: approaches from the far background, growing
    // and sharpening into place, losing its slight tilt as it arrives ----
    photosOf(next).forEach(function (p, pi) {
      master.fromTo(p, { z: -DEPTH.photo, rotationY: -6 }, {
        z: 0,
        rotationY: 0,
        duration: 1,
        ease: "power2.out"
      }, t + pi * 0.03);
      master.fromTo(p, { opacity: 0 }, {
        opacity: 1,
        duration: 0.6,
        ease: "power2.out"
      }, t + pi * 0.03);
    });

    // ---- incoming text: rises up into place from below its mask ----
    var inText = textOf(next);
    if (inText) {
      master.fromTo(inText.children, { yPercent: TEXT_TRAVEL, opacity: 0 }, {
        yPercent: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.04
      }, t + 0.25);
    }

    master.fromTo(yearOf(next), { z: -DEPTH.year, opacity: 0 }, {
      z: 0,
      opacity: 1,
      duration: 1,
      ease: "power2.out"
    }, t + 0.15);
  });

  // ================= spacebar: advance one slide per press =================
  window.addEventListener("keydown", function (e) {
    var isSpace = e.code === "Space" || e.key === " " || e.key === "Spacebar" || e.keyCode === 32;
    if (!isSpace) return;
    e.preventDefault();

    var st = master.scrollTrigger;
    var currentIndex = Math.round(st.progress * segments);
    var targetIndex = Math.min(currentIndex + 1, segments);
    var targetScroll = st.start + (st.end - st.start) * (targetIndex / segments);

    window.scrollTo({ top: targetScroll, behavior: "smooth" });
  });
})();
