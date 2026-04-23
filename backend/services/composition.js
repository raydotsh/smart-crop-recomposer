function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundRect(rect) {
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function fitAspectInside(imageWidth, imageHeight, aspectRatio) {
  if (!aspectRatio || aspectRatio <= 0) {
    return { width: imageWidth, height: imageHeight };
  }

  const imageRatio = imageWidth / imageHeight;
  if (imageRatio > aspectRatio) {
    return {
      width: imageHeight * aspectRatio,
      height: imageHeight
    };
  }

  return {
    width: imageWidth,
    height: imageWidth / aspectRatio
  };
}

function buildSubjectFallback(imageWidth, imageHeight) {
  const fallbackWidth = imageWidth * 0.35;
  const fallbackHeight = imageHeight * 0.35;

  return {
    x: (imageWidth - fallbackWidth) / 2,
    y: (imageHeight - fallbackHeight) / 2,
    width: fallbackWidth,
    height: fallbackHeight
  };
}

function normalizeRect(rect, imageWidth, imageHeight) {
  const width = clamp(rect.width, 1, imageWidth);
  const height = clamp(rect.height, 1, imageHeight);
  const left = clamp(rect.left, 0, imageWidth - width);
  const top = clamp(rect.top, 0, imageHeight - height);

  return roundRect({ left, top, width, height });
}

function makeCropForTarget({
  imageWidth,
  imageHeight,
  subject,
  aspectRatio,
  targetPointX,
  targetPointY
}) {
  const base = fitAspectInside(imageWidth, imageHeight, aspectRatio);
  const subjectCenterX = subject.x + subject.width / 2;
  const subjectCenterY = subject.y + subject.height / 2;

  const minWidth = Math.max(base.width * 0.6, subject.width * 1.8);
  const minHeight = Math.max(base.height * 0.6, subject.height * 1.8);
  const width = clamp(Math.max(base.width, minWidth), 1, imageWidth);
  const height = clamp(Math.max(base.height, minHeight), 1, imageHeight);

  const left = subjectCenterX - width * targetPointX;
  const top = subjectCenterY - height * targetPointY;

  return normalizeRect({ left, top, width, height }, imageWidth, imageHeight);
}

function calculateCenteredCrop(context) {
  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || context.imageWidth / context.imageHeight,
    targetPointX: 0.5,
    targetPointY: 0.5
  });
}

function calculateRuleOfThirdsCrop(context) {
  const subjectCenterX = context.subject.x + context.subject.width / 2;
  const subjectCenterY = context.subject.y + context.subject.height / 2;
  const horizontalThird = subjectCenterX < context.imageWidth / 2 ? 1 / 3 : 2 / 3;
  const verticalThird = subjectCenterY < context.imageHeight / 2 ? 1 / 3 : 2 / 3;

  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || context.imageWidth / context.imageHeight,
    targetPointX: horizontalThird,
    targetPointY: verticalThird
  });
}

function calculateCinematicCrop(context) {
  const subjectCenterX = context.subject.x + context.subject.width / 2;
  const targetPointX = subjectCenterX < context.imageWidth / 2 ? 0.36 : 0.64;

  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || 16 / 9,
    targetPointX,
    targetPointY: 0.5
  });
}

function calculateTextFriendlyCrop(context) {
  const subjectCenterX = context.subject.x + context.subject.width / 2;
  const availableLeft = context.subject.x;
  const availableRight = context.imageWidth - (context.subject.x + context.subject.width);
  const wantsTextOnRight = availableRight >= availableLeft;
  const targetPointX = wantsTextOnRight ? 0.3 : 0.7;

  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || 16 / 9,
    targetPointX: subjectCenterX < context.imageWidth / 2 ? Math.min(targetPointX, 0.38) : Math.max(targetPointX, 0.62),
    targetPointY: 0.5
  });
}

function calculateSocialPostCrop(context) {
  // 1:1 square crop with subject centered — ideal for Instagram / social posts
  return makeCropForTarget({
    ...context,
    aspectRatio: 1,
    targetPointX: 0.5,
    targetPointY: 0.5
  });
}

function calculateHeadlineSpaceCrop(context) {
  const subjectCenterX = context.subject.x + context.subject.width / 2;
  const availableLeft = context.subject.x;
  const availableRight = context.imageWidth - (context.subject.x + context.subject.width);
  const prefersHeadlineOnRight = availableRight >= availableLeft;
  const targetPointX = prefersHeadlineOnRight ? 0.28 : 0.72;

  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || 16 / 9,
    targetPointX: subjectCenterX < context.imageWidth / 2 ? Math.min(targetPointX, 0.36) : Math.max(targetPointX, 0.64),
    targetPointY: 0.48
  });
}

function calculateBalancedCrop(context) {
  const subjectCenterX = context.subject.x + context.subject.width / 2;
  const subjectCenterY = context.subject.y + context.subject.height / 2;
  const widthBias = context.subject.width / context.imageWidth > 0.45 ? 0.5 : subjectCenterX < context.imageWidth / 2 ? 0.42 : 0.58;
  const heightBias = subjectCenterY < context.imageHeight / 2 ? 0.44 : 0.56;

  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || context.imageWidth / context.imageHeight,
    targetPointX: widthBias,
    targetPointY: heightBias
  });
}

function calculatePortraitSafeCrop(context) {
  const subjectCenterY = context.subject.y + context.subject.height / 2;

  return makeCropForTarget({
    ...context,
    aspectRatio: context.aspectRatio || 4 / 5,
    targetPointX: 0.5,
    targetPointY: subjectCenterY < context.imageHeight / 2 ? 0.42 : 0.52
  });
}

function resolveIntent(intent) {
  switch (intent) {
    case "make-room-for-headline":
    case "headline-space":
    case "text-friendly":
      return "headline-space";
    case "fix-off-balance-framing":
    case "balanced":
    case "rule-of-thirds":
      return "balanced";
    case "make-it-feel-intentional":
    case "cinematic":
      return "intentional";
    case "prepare-for-social-post":
    case "social-post":
      return "social-post";
    case "keep-subject-clean":
    case "portrait-safe":
      return "portrait-safe";
    case "centered":
    default:
      return "centered";
  }
}

function calculateCrop({ imageWidth, imageHeight, bbox, layout, intent, aspectRatio }) {
  if (!imageWidth || !imageHeight) {
    throw new Error("Image dimensions are required.");
  }

  if (imageWidth < 4 || imageHeight < 4) {
    return { left: 0, top: 0, width: Math.max(imageWidth, 1), height: Math.max(imageHeight, 1) };
  }

  const subject = bbox || buildSubjectFallback(imageWidth, imageHeight);
  const context = {
    imageWidth,
    imageHeight,
    subject,
    aspectRatio
  };

  switch (resolveIntent(intent || layout)) {
    case "balanced":
      return calculateBalancedCrop(context);
    case "intentional":
      return calculateCinematicCrop(context);
    case "headline-space":
      return calculateHeadlineSpaceCrop(context);
    case "social-post":
      return calculateSocialPostCrop(context);
    case "portrait-safe":
      return calculatePortraitSafeCrop(context);
    case "centered":
    default:
      return calculateCenteredCrop(context);
  }
}

module.exports = {
  calculateCrop
};
