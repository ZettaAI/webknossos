package com.scalableminds.webknossos.datastore.models

import com.scalableminds.util.geometry.{BoundingBox, Vec3Double, Vec3Int}
import com.scalableminds.webknossos.datastore.models.datasource.DatasetViewConfiguration.DatasetViewConfiguration
import com.scalableminds.webknossos.datastore.models.datasource.inbox.GenericInboxDataSource
import play.api.libs.json._

import scala.annotation.nowarn

package object datasource {

  // here team is not (yet) renamed to organization to avoid migrating all jsons
  case class DataSourceId(name: String, team: String) {
    override def toString: String = s"DataSourceId($team/$name)"
  }

  object DataSourceId {
    implicit val dataSourceIdFormat: Format[DataSourceId] = Json.format[DataSourceId]
  }

  object DatasetViewConfiguration {
    type DatasetViewConfiguration = Map[String, JsValue]
    implicit val jsonFormat: Format[DatasetViewConfiguration] = Format.of[DatasetViewConfiguration]
  }

  case class GenericDataSource[+T <: DataLayerLike](id: DataSourceId,
                                                    dataLayers: List[T],
                                                    scale: Vec3Double,
                                                    defaultViewConfiguration: Option[DatasetViewConfiguration] = None)
      extends GenericInboxDataSource[T] {

    val toUsable: Option[GenericDataSource[T]] = Some(this)

    val scaleOpt: Option[Vec3Double] = Some(scale)

    val statusOpt: Option[String] = None

    def getDataLayer(name: String): Option[T] =
      dataLayers.find(_.name == name)

    val center: Vec3Int = boundingBox.center

    lazy val boundingBox: BoundingBox =
      BoundingBox.union(dataLayers.map(_.boundingBox))

    def segmentationLayers: List[SegmentationLayer] = dataLayers.flatMap {
      case layer: SegmentationLayer => Some(layer)
      case _                        => None
    }

    def additionalAxesUnion: Option[Seq[AdditionalAxis]] =
      AdditionalAxis.merge(dataLayers.map(_.additionalAxes))

  }

  object GenericDataSource {
    @nowarn // Suppress unused warning. The passed Format[T] is expanded to more than what is really used. It can not be omitted, though.
    implicit def dataSourceFormat[T <: DataLayerLike](implicit fmt: Format[T]): Format[GenericDataSource[T]] =
      Json.format[GenericDataSource[T]]

    val FILENAME_DATASOURCE_PROPERTIES_JSON: String = "datasource-properties.json"
  }

  type DataSource = GenericDataSource[DataLayer]
  type DataSourceLike = GenericDataSource[DataLayerLike]
}
