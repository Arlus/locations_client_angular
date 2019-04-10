// entry component for the client
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { select, Store } from '../../../../midgard/modules/store/store';
import { CircleMarker, circleMarker, icon, latLng, marker, tileLayer } from 'leaflet';
import { FormComponent } from '../../../../midgard/modules/form/form.component';
import { setTopBarOptions } from '../../../../midgard/state/top-bar/top-bar.actions';
import { getAllLocations, getLocationsLoaded } from './state/locations.selectors';
import { HttpService } from '../../../../midgard/modules/http/http.service';
import { countries } from './countries';
import { Observable, Subscription } from 'rxjs';
import { CrudComponent } from '../../../../midgard/modules/crud/crud.component';
import { Location } from './state/location.model';
import { map } from 'rxjs/internal/operators';
@Component({
  selector: 'lib-locations',
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.scss']
})
export class LocationsComponent implements OnInit {
  @ViewChild('locationsForm') locationsForm: FormComponent;
  @ViewChild('crud') crud: CrudComponent;

  private tableOptions;
  protected formFields;
  protected crudLoadedSelector = getLocationsLoaded;
  protected crudDataSelector = getAllLocations;
  private marker = marker([ 52.5200, 13.4050 ], {
    icon: icon({
      iconSize: [ 25, 41 ],
      iconAnchor: [ 13, 41 ],
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png'
    }), draggable: true});
  private options = {
    layers: [
      this.marker,
      tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, minZoom: 2, attribution: 'Midgard' }),
    ],
    zoom: 4,
    center: latLng(52.5200, 13.4050)
  };
  constructor(
    private store: Store<any>,
    private httpService: HttpService
  ) {}
  ngOnInit() {
    this.store.dispatch(setTopBarOptions(null));
    this.defineFormFields();
    this.defineTableOptions();
    this.onMarkerPositionChanged();
  }

  addMarkersOnMap(locations) {
    if (locations) {
      // reset markers
      this.options.layers = [this.marker, tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, minZoom: 2, attribution: 'Midgard' })];
      locations.forEach((location: Location) => {
        const locationMarker = circleMarker([location.latitude, location.longitude], {color: 'green', uniqueID: location.uuid});
        locationMarker.on('click', (event) => {
          this.onMarkerClicked(event);
        });
        this.options.layers.push(locationMarker);
      });
    }
  }

  /**
   * defines form fields of the detail view
   */
  defineFormFields() {
    this.formFields = [
      {label: 'Lat.', controlName: 'latitude', type: 'text'},
      {label: 'Lng.', controlName: 'longitude', type: 'text'},
      {label: 'Street', controlName: 'address_line1', type: 'text'},
      {label: 'City/State', controlName: 'city', type: 'text'},
      {label: 'Postcode', controlName: 'postcode', type: 'text'},
      {label: 'Country', controlName: 'country', type: 'nativeDropdown', options: countries}
    ];
  }

  private defineTableOptions() {
    this.tableOptions = {
      columns: [
        {name: 'Street', prop: 'address_line1', flex: 2, sortable: true, filtering: true},
        {name: 'City/State', prop: 'city', flex: 2, sortable: true, filtering: true},
        {name: 'Country', prop: 'country', flex: 2, sortable: true, filtering: false},
        {name: 'Postcode', prop: 'postcode', flex: 2, sortable: true, filtering: false},
        {name: 'Lat.', prop: 'latitude', flex: 2, sortable: true, filtering: false},
        {name: 'Lng.', prop: 'longitude', flex: 2, sortable: true, filtering: false},
        {name: '', cellTemplate: 'actions', actions: ['delete'], prop: 'is_active', flex: 2},
      ]
    };
  }

  /**
   * this function is triggered when the marker position is changed its purpose is to insert the lang long to the form
   */
  private onMarkerPositionChanged() {
    this.marker.on('moveend', (evt) => {
      this.locationsForm.detailsForm.get('latitude').patchValue(evt.target._latlng.lat);
      this.locationsForm.detailsForm.get('longitude').patchValue(evt.target._latlng.lng);
      this.getAddressFromLatLng(evt.target._latlng.lat, evt.target._latlng.lng).subscribe(address => {
        this.locationsForm.detailsForm.get('city').patchValue(address.city || address.state);
        this.locationsForm.detailsForm.get('country').patchValue(address.country_code.toUpperCase());
        this.locationsForm.detailsForm.get('postcode').patchValue(address.postcode);
      });
    });
  }

  /**
   * submits the location form
   */
  protected onFormSubmitted() {
    this.locationsForm.createItem(this.locationsForm.detailsForm.value);
  }

  /**
   * a function that is triggered with the user clicks on an item in the table and its purpose is to set the location form values with this item
   * @param item - the selected item
   */
  protected onLocationClicked(item) {
    // set values of the form from the selected item
    this.locationsForm.detailsForm.get('address_line1').patchValue(item.address_line1);
    this.locationsForm.detailsForm.get('city').patchValue(item.city);
    this.locationsForm.detailsForm.get('country').patchValue(item.country);
    this.locationsForm.detailsForm.get('postcode').patchValue(item.postcode);
    this.locationsForm.detailsForm.get('latitude').patchValue(item.latitude);
    this.locationsForm.detailsForm.get('longitude').patchValue(item.longitude);
    // move the marker of the map to the current coordinates
    this.marker.setLatLng(latLng(item.latitude, item.longitude));
    this.options.center = latLng(item.latitude, item.longitude);
  }

  /**
   * reverse geocoding to get the address from provided latitude and longitude, using openstreetmap
   * @param lat - longitude of the location
   * @param lng - longitude of the location
   * @returns {Observable}
   */
  private getAddressFromLatLng(lat: string, lng: string): Observable {
    return this.httpService
      .makeRequest('GET', 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1')
      .pipe(
        map(res => res.data.address)
      );
  }

  /**
   * set the form fields when the user clicks on a marker
   * @param {CircleMarekr} clickedMarker - the clicked marker
   */
  protected onMarkerClicked(clickedMarker: CircleMarker) {
    const clickedLocation = this.crud.rows.find(location => location.uuid === clickedMarker.sourceTarget.options.uniqueID);
    this.onLocationClicked(clickedLocation);
  }

}

