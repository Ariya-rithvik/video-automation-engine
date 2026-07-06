import { Config } from '@remotion/cli/config';

// JPEG intermediate frames render faster than PNG with negligible quality loss for h264 output
Config.setVideoImageFormat('jpeg');

// 4 parallel Chromium tabs — sweet spot for ~16GB machines
Config.setConcurrency(4);

// h264 is universal and small
Config.setCodec('h264');
