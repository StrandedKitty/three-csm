import * as THREE from 'three'
import CSM from './CSM'

class CSMHelper extends THREE.Object3D {
  private displayFrustum = true
  private displayPlanes = true
  private displayShadowBounds = true

  private frustumLines: THREE.LineSegments<THREE.BufferGeometry>
  private cascadeLines: THREE.Box3Helper[] = []
  private cascadePlanes: THREE.Mesh[] = []
  private shadowLines: THREE.Group[] = []

  constructor (private csm: CSM) {
    super()

    const indices = new Uint16Array([ 0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7 ])
    const positions = new Float32Array(24)
    const frustumGeometry = new THREE.BufferGeometry()
    frustumGeometry.setIndex(new THREE.BufferAttribute(indices, 1))
    frustumGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3, false))
    const frustumLines = new THREE.LineSegments(frustumGeometry, new THREE.LineBasicMaterial())
    this.add(frustumLines)

    this.frustumLines = frustumLines
  }

  updateVisibility () {
    const displayFrustum = this.displayFrustum
    const displayPlanes = this.displayPlanes
    const displayShadowBounds = this.displayShadowBounds

    const frustumLines = this.frustumLines
    const cascadeLines = this.cascadeLines
    const cascadePlanes = this.cascadePlanes
    const shadowLines = this.shadowLines

    const l = cascadeLines.length
    for (let i = 0; i < l; i ++) {
      const cascadeLine = cascadeLines[i]
      const cascadePlane = cascadePlanes[i]
      const shadowLineGroup = shadowLines[i]

      cascadeLine.visible = displayFrustum
      cascadePlane.visible = (displayFrustum && displayPlanes)
      shadowLineGroup.visible = displayShadowBounds
    }

    frustumLines.visible = displayFrustum
  }

  update () {
    const csm = this.csm
    const camera = csm.camera
    const cascades = csm.cascades
    const mainFrustum = csm.mainFrustum
    const frustums = csm.frustums
    const lights = csm.lights

    const frustumLines = this.frustumLines
    const frustumLinePositions = frustumLines.geometry.getAttribute('position')
    const cascadeLines = this.cascadeLines
    const cascadePlanes = this.cascadePlanes
    const shadowLines = this.shadowLines

    this.position.copy(camera.position)
    this.quaternion.copy(camera.quaternion)
    this.scale.copy(camera.scale)
    this.updateMatrixWorld(true)

    while (cascadeLines.length > cascades) {
      this.remove(cascadeLines.pop())
      this.remove(cascadePlanes.pop())
      this.remove(shadowLines.pop())
    }

    while (cascadeLines.length < cascades) {
      const cascadeLine = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xffffff))
      const planeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
      const cascadePlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(), planeMat)
      const shadowLineGroup = new THREE.Group()
      const shadowLine = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xffff00))
      shadowLineGroup.add(shadowLine)

      this.add(cascadeLine)
      this.add(cascadePlane)
      this.add(shadowLineGroup)

      cascadeLines.push(cascadeLine)
      cascadePlanes.push(cascadePlane)
      shadowLines.push(shadowLineGroup)
    }

    for (let i = 0; i < cascades; i ++) {
      const frustum = frustums[i]
      const light = lights[i]
      const shadowCam = light.shadow.camera
      const farVertices = frustum.vertices.far

      const cascadeLine = cascadeLines[i]
      const cascadePlane = cascadePlanes[i]
      const shadowLineGroup = shadowLines[i]
      const shadowLine = shadowLineGroup.children[0] as THREE.Box3Helper

      cascadeLine.box.min.copy(farVertices[2])
      cascadeLine.box.max.copy(farVertices[0])
      cascadeLine.box.max.z += 1e-4

      cascadePlane.position.addVectors(farVertices[0], farVertices[2])
      cascadePlane.position.multiplyScalar(0.5)
      cascadePlane.scale.subVectors(farVertices[0], farVertices[2])
      cascadePlane.scale.z = 1e-4

      this.remove(shadowLineGroup)
      shadowLineGroup.position.copy(shadowCam.position)
      shadowLineGroup.quaternion.copy(shadowCam.quaternion)
      shadowLineGroup.scale.copy(shadowCam.scale)
      shadowLineGroup.updateMatrixWorld(true)
      this.attach(shadowLineGroup)

      shadowLine.box.min.set(shadowCam.bottom, shadowCam.left, - shadowCam.far)
      shadowLine.box.max.set(shadowCam.top, shadowCam.right, - shadowCam.near)

    }

    const nearVertices = mainFrustum.vertices.near
    const farVertices = mainFrustum.vertices.far
    frustumLinePositions.setXYZ(0, farVertices[0].x, farVertices[0].y, farVertices[0].z)
    frustumLinePositions.setXYZ(1, farVertices[3].x, farVertices[3].y, farVertices[3].z)
    frustumLinePositions.setXYZ(2, farVertices[2].x, farVertices[2].y, farVertices[2].z)
    frustumLinePositions.setXYZ(3, farVertices[1].x, farVertices[1].y, farVertices[1].z)

    frustumLinePositions.setXYZ(4, nearVertices[0].x, nearVertices[0].y, nearVertices[0].z)
    frustumLinePositions.setXYZ(5, nearVertices[3].x, nearVertices[3].y, nearVertices[3].z)
    frustumLinePositions.setXYZ(6, nearVertices[2].x, nearVertices[2].y, nearVertices[2].z)
    frustumLinePositions.setXYZ(7, nearVertices[1].x, nearVertices[1].y, nearVertices[1].z)
    frustumLinePositions.needsUpdate = true
  }
}

export { CSMHelper }
