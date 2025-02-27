package com.scalableminds.webknossos.datastore.explore

import com.scalableminds.util.geometry.Vec3Double
import com.scalableminds.util.tools.Fox
import com.scalableminds.webknossos.datastore.dataformats.MagLocator
import com.scalableminds.webknossos.datastore.dataformats.zarr.{ZarrDataLayer, ZarrSegmentationLayer}
import com.scalableminds.webknossos.datastore.dataformats.zarr3.{Zarr3DataLayer, Zarr3SegmentationLayer}
import com.scalableminds.webknossos.datastore.datareaders.zarr.ZarrHeader
import com.scalableminds.webknossos.datastore.datareaders.zarr3.Zarr3ArrayHeader
import com.scalableminds.webknossos.datastore.datavault.VaultPath
import com.scalableminds.webknossos.datastore.models.datasource.{DataLayer, DataSource, GenericDataSource}

import scala.concurrent.ExecutionContext

class WebknossosZarrExplorer(implicit val ec: ExecutionContext) extends RemoteLayerExplorer {

  override def name: String = "WEBKNOSSOS-based Zarr"

  override def explore(remotePath: VaultPath, credentialId: Option[String]): Fox[List[(DataLayer, Vec3Double)]] =
    for {
      dataSourcePropertiesPath <- Fox.successful(remotePath / GenericDataSource.FILENAME_DATASOURCE_PROPERTIES_JSON)
      dataSource <- parseJsonFromPath[DataSource](dataSourcePropertiesPath)
      zarrLayers <- Fox.serialCombined(dataSource.dataLayers) {
        case l: Zarr3SegmentationLayer =>
          for {
            mags <- fixMagsWithRemotePaths(l.mags, remotePath / l.name, Zarr3ArrayHeader.FILENAME_ZARR_JSON)
          } yield l.copy(mags = mags)
        case l: Zarr3DataLayer =>
          for {
            mags <- fixMagsWithRemotePaths(l.mags, remotePath / l.name, Zarr3ArrayHeader.FILENAME_ZARR_JSON)
          } yield l.copy(mags = mags)
        case l: ZarrSegmentationLayer =>
          for {
            mags <- fixMagsWithRemotePaths(l.mags, remotePath / l.name, ZarrHeader.FILENAME_DOT_ZARRAY)
          } yield l.copy(mags = mags)
        case l: ZarrDataLayer =>
          for {
            mags <- fixMagsWithRemotePaths(l.mags, remotePath / l.name, ZarrHeader.FILENAME_DOT_ZARRAY)
          } yield l.copy(mags = mags)
        case layer => Fox.failure(s"Only remote Zarr or Zarr3 layers are supported, got ${layer.getClass}.")
      }
      zarrLayersWithScale <- Fox.serialCombined(zarrLayers)(l => Fox.successful((l, dataSource.scale)))
    } yield zarrLayersWithScale

  private def fixMagsWithRemotePaths(mags: List[MagLocator],
                                     remoteLayerPath: VaultPath,
                                     headerFilename: String): Fox[List[MagLocator]] =
    Fox.serialCombined(mags)(m =>
      for {
        magPath <- fixRemoteMagPath(m, remoteLayerPath, headerFilename)
      } yield m.copy(path = magPath))

  private def fixRemoteMagPath(mag: MagLocator,
                               remoteLayerPath: VaultPath,
                               headerFilename: String): Fox[Option[String]] =
    mag.path match {
      case Some(path) => Fox.successful(Some(path))
      case None       =>
        // Only scalar mag paths are attempted for now
        val magPath = remoteLayerPath / mag.mag.toMagLiteral(allowScalar = true)
        val magHeaderPath = magPath / headerFilename
        for {
          _ <- magHeaderPath.readBytes() ?~> s"Could not find $magPath"
        } yield Some(magPath.toUri.toString)
    }

}
