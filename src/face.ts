/**
 *
 */
// import ndarray = require('ndarray')

import {
  FaceEmbedding,
  log,
}                           from './config'
import {
  createImageData,
  cropImage,
  imageMd5,
}                           from './misc'

export interface Point {
  x: number,
  y: number,
}

export interface Rectangle {
  x: number,  // left
  y: number,  // top
  w: number,  // width
  h: number,  // height
}

export interface FacialLandmark {
  [idx: string]:    Point,
  leftEye:          Point,
  rightEye:         Point,
  nose:             Point,
  leftMouthCorner:  Point,
  rightMouthCorner: Point,
}

export interface FaceJsonObject {
  _embedding:     FaceEmbedding,
  boundingBox?:   number[],
  confidence:     number,
  facialLandmark: FacialLandmark,
  imageData:      string,   // Base64 of Buffer
  rect:           Rectangle,
}

export class Face {
  public static id = 0
  public id: number
  public md5: string

  public rect:            Rectangle
  public confidence:      number
  public facialLandmark:  FacialLandmark

  private _embedding: FaceEmbedding

  constructor(
    public imageData:     ImageData,
    private boundingBox?:  number[], // [x0, y0, x1, y1]
  ) {
    this.id = ++Face.id

    log.verbose('Face', 'constructor(%dx%d, [%s]) #%d',
                      imageData.width,
                      imageData.height,
                      boundingBox,
                      this.id,
              )

    if (!boundingBox) {
      boundingBox = [0, 0, imageData.width, imageData.height]
    }

    this.rect = {
      x: boundingBox[0],
      y: boundingBox[1],
      w: boundingBox[2] - boundingBox[0],
      h: boundingBox[3] - boundingBox[1],
    }

    if (   this.rect.w !== imageData.width
        || this.rect.h !== imageData.height
    ) { // need to corp and reset this.data
      log.verbose('Face', 'constructor() box.w=%d, box.h=%d; image.w=%d, image.h=%d',
                        this.rect.w,
                        this.rect.h,
                        imageData.width,
                        imageData.height,
              )
      this.imageData = cropImage(
        imageData,
        this.rect.x,
        this.rect.y,
        this.rect.w,
        this.rect.h,
      )
    }
    // update md5 after image crop
    this.md5 = imageMd5(this.imageData)
  }

  public toString(): string {
    return `Face#${this.id}#${this.md5}<${this._embedding}>`
  }

  public toJSON(): FaceJsonObject {
    const imageData = Buffer.from(this.imageData.data.buffer)
                            .toString('base64')
    const {
      _embedding,
      boundingBox,
      confidence,
      facialLandmark,
      rect,
    } = this

    return {
      _embedding,
      boundingBox,
      confidence,
      facialLandmark,
      imageData,
      rect,
    }
  }

  public static fromJSON(obj: FaceJsonObject | string): Face {
    if (typeof obj === 'string') {
      obj = JSON.parse(obj) as FaceJsonObject
    }

    const buffer  = Buffer.from(obj.imageData, 'base64')
    const array   = new Uint8ClampedArray(buffer)

    const rect = obj.rect
    const imageData = createImageData(array, rect.w, rect.h)

    const face = new Face(
      imageData,
      [
        rect.x,
        rect.y,
        rect.x + rect.w,
        rect.y + rect.h,
      ],
    )

    face._embedding     = obj._embedding
    face.boundingBox    = obj.boundingBox
    face.facialLandmark = obj.facialLandmark
    face.rect           = obj.rect
    face.confidence     = obj.confidence

    return face
  }

  public init(
    marks: number[][],  // Facial Landmark
    confidence: number,
  ): void {
    this.confidence   = confidence

    const leftEye: Point = {
      x: Math.round(marks[0][0]),
      y: Math.round(marks[0][1]),
    }
    const rightEye: Point = {
      x: Math.round(marks[1][0]),
      y: Math.round(marks[1][1]),
    }
    const nose: Point = {
      x: Math.round(marks[2][0]),
      y: Math.round(marks[2][1]),
    }
    const leftMouthCorner: Point = {
      x: Math.round(marks[3][0]),
      y: Math.round(marks[3][1]),
    }
    const rightMouthCorner: Point = {
      x: Math.round(marks[4][0]),
      y: Math.round(marks[4][1]),
    }

    this.facialLandmark = {
      leftEye,
      rightEye,
      nose,
      leftMouthCorner,
      rightMouthCorner,
    }
  }

  public get embedding(): FaceEmbedding {
    if (!this._embedding) {
      throw new Error('no embedding yet!')
    }
    return this._embedding
  }

  public set embedding(embedding: FaceEmbedding) {
    if (this._embedding) {
      throw new Error('already had embedding!')
    } else if (embedding.shape[0] !== 128) {
      throw new Error('embedding dim is not 128!')
    }
    this._embedding = embedding
  }

  /**
   * Center point for the boundingBox
   */
  public get center(): Point {
    const x = Math.round(this.rect.x + this.imageData.width  / 2)
    const y = Math.round(this.rect.y + this.imageData.height / 2)
    return {x, y}
  }

  public get width(): number {
    return this.imageData.width
  }

  public get height(): number {
    return this.imageData.height
  }

  public get depth(): number {
    return this.imageData.data.length
            / this.imageData.width
            / this.imageData.height
  }
}
