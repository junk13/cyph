import {Component} from '@angular/core';
import {AccountService} from '../services/account.service';
import {StringsService} from '../services/strings.service';


/**
 * Angular component for account user rating UI.
 */
@Component({
	selector: 'cyph-account-user-rating',
	styleUrls: ['../../../css/components/account-user-rating.scss'],
	templateUrl: '../../../templates/account-user-rating.html'
})
export class AccountUserRatingComponent {
	constructor (
		/** @see AccountService */
		public readonly accountService: AccountService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {}
}