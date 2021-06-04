import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: CameraPhoto[] = [];
  private photoStorage = 'photos';

  constructor(private readonly platform: Platform) { }

  /**
   * Adds a new photo to the gallery.
   */
  public async addNewToGallery(): Promise<void> {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift({
      filepath: savedImageFile.filePath,
      webviewPath: savedImageFile.webviewPath
    });

    Storage.set({
      key: this.photoStorage,
      value: JSON.stringify(this.photos)
    });
  }

  /**
   * Loads all saved photos from storage.
   */
  public async loadSavedPhotos() {
    const photoList = await Storage.get({ key: this.photoStorage });
    this.photos = JSON.parse(photoList.value) || [];

    if (!this.platform.is('hybrid')) {
      for (const photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data
        });

        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  /**
   * Saves a picture to the file system.
   *
   * @param cameraPhoto The photo taken by the camera.
   * @returns The file path and web view path.
   */
  private async savePicture(cameraPhoto: Photo) {
    const base64Data = await this.readAsUrl(cameraPhoto);

    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    if (this.platform.is('hybrid')) {
      return {
        filePath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    }

    return {
      filePath: fileName,
      webviewPath: cameraPhoto.webPath
    };
  }

  /**
   * Reads a file as a URL.
   *
   * @param cameraPhoto The photo taken by the camera.
   * @returns The base 64 string.
   */
  private async readAsUrl(cameraPhoto: Photo) {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: cameraPhoto.path
      });

      return file.data;
    }

    const response = await fetch(cameraPhoto.webPath);
    const blob = await response.blob();

    return await this.convertBlobToBase64(blob) as string;
  }

  /**
   * Converts a file to a base64 string.
   *
   * @param blob The file to be converted.
   * @returns The base 64 string.
   */
  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

export interface CameraPhoto {
  filepath: string;
  webviewPath: string;
}
