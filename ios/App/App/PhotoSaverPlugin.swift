import Foundation
import Photos
import UIKit
import Capacitor

@objc(PhotoSaverPlugin)
public class PhotoSaverPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoSaverPlugin"
    public let jsName = "PhotoSaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "savePhoto", returnType: CAPPluginReturnPromise)
    ]

    @objc func savePhoto(_ call: CAPPluginCall) {
        guard let dataString = call.getString("data") else {
            call.reject("Must provide image data")
            return
        }

        let cleanBase64 = dataString.contains(",") ? String(dataString.split(separator: ",")[1]) : dataString
        guard let imageData = Data(base64Encoded: cleanBase64), let image = UIImage(data: imageData) else {
            call.reject("Invalid image data")
            return
        }

        PHPhotoLibrary.requestAuthorization { status in
            if status == .authorized || status == .limited {
                UIImageWriteToSavedPhotosAlbum(image, self, #selector(self.image(_:didFinishSavingWithError:contextInfo:)), nil)
                call.resolve(["success": true])
            } else {
                call.reject("Photo library permission denied")
            }
        }
    }

    @objc func image(_ image: UIImage, didFinishSavingWithError error: Error?, contextInfo: UnsafeRawPointer) {
        if let error = error {
            print("Photo save error: \(error.localizedDescription)")
        } else {
            print("Photo saved successfully to Camera Roll")
        }
    }
}
