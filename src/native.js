import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';

export const isNativePlatform = () => Capacitor.isNativePlatform();

/**
 * 触发触感反馈
 * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'} type
 */
export async function triggerHaptic(type = 'light') {
  try {
    if (!Capacitor.isPluginAvailable('Haptics')) return;
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (type === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (type === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (type === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (type === 'error') {
      await Haptics.notification({ type: NotificationType.Error });
    }
  } catch (e) {
    // 忽略非移动端或不支持触感环境的报错
  }
}

/**
 * 显示提示信息 (HUD Toast)
 * @param {string} text
 */
export function showToast(text) {
  const existing = document.getElementById('web-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'web-toast';
  toast.className = 'cyber-toast';
  toast.innerText = text;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/**
 * 将单张图片直接保存到系统相册
 * @param {string} dataUrl
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
export async function saveImageToAlbum(dataUrl, filename = 'physics_typeset.jpg') {
  triggerHaptic('light');

  // 1. 原生 iOS App 环境：使用 Media 插件直接写入系统相册 (Camera Roll)
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = dataUrl.split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });

      await Media.savePhoto({
        path: savedFile.uri
      });

      return true;
    } catch (e) {
      console.warn('Media.savePhoto failed, trying direct dataUrl fallback:', e);
      try {
        await Media.savePhoto({ path: dataUrl });
        return true;
      } catch (err) {
        console.error('All native photo save attempts failed:', err);
      }
    }
  }

  // 2. Web / PWA 环境：使用 Web Share API 唤起 iOS 系统保存面板
  if (navigator.canShare) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '保存排版图片',
          text: '保存生成的 A4 物理排版图片到相册'
        });
        return true;
      }
    } catch (e) {
      console.warn('Web Share API aborted or failed:', e);
    }
  }

  // 3. 兜底下载方式
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/**
 * 一键批量保存所有生成的排版图片到系统相册
 * @param {Array<{dataUrl: string, pageIndex: number}>} images
 */
export async function batchSaveImagesToAlbum(images) {
  if (!images || images.length === 0) {
    showToast('暂无可保存的排版图片');
    return;
  }

  triggerHaptic('medium');
  let successCount = 0;

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const filename = `physics_typeset_p${item.pageIndex}_${Date.now()}.jpg`;
    try {
      const ok = await saveImageToAlbum(item.dataUrl, filename);
      if (ok) successCount++;
      if (i < images.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`Error saving page ${item.pageIndex}:`, err);
    }
  }

  triggerHaptic('success');
  showToast(`🎉 成功保存 ${successCount} 页排版图片至相册！`);
}

/**
 * 分享所有图片 (原生分享面板)
 * @param {Array<{dataUrl: string, pageIndex: number}>} images
 */
export async function shareAllImages(images) {
  if (!images || images.length === 0) return;
  triggerHaptic('light');

  if (navigator.canShare) {
    try {
      const files = [];
      for (const item of images) {
        const response = await fetch(item.dataUrl);
        const blob = await response.blob();
        files.push(new File([blob], `physics_page_${item.pageIndex}.jpg`, { type: 'image/jpeg' }));
      }
      if (navigator.canShare({ files })) {
        await navigator.share({
          files,
          title: 'A4 物理排版图片',
          text: `共 ${images.length} 页解答`
        });
        return;
      }
    } catch (e) {
      console.warn('Web Share failed:', e);
    }
  }

  // 兜底批量保存
  await batchSaveImagesToAlbum(images);
}

/**
 * 从剪贴板读取文本
 */
export async function readClipboardText() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
  } catch (e) {
    console.warn('Clipboard read failed:', e);
  }
  return null;
}
