import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable} from 'rxjs/Observable';
import {IAccountFileRecord, IForm} from '../../proto';
import {AccountFilesService} from '../../services/account-files.service';
import {AccountService} from '../../services/account.service';
import {EnvService} from '../../services/env.service';
import {StringsService} from '../../services/strings.service';


/**
 * Angular component for an individual form.
 */
@Component({
	selector: 'cyph-account-form',
	styleUrls: ['./account-form.component.scss'],
	templateUrl: './account-form.component.html'
})
export class AccountFormComponent implements OnInit {
	/** Current form. */
	public form?: {
		data: Promise<IForm>;
		downloadProgress: Observable<number>;
		metadata: Observable<IAccountFileRecord>;
	};

	/** @inheritDoc */
	public ngOnInit () : void {
		this.activatedRoute.params.subscribe(async o => {
			try {
				const id: string|undefined	= o.id;

				if (!id) {
					throw new Error('Invalid form ID.');
				}

				const downloadTask	= this.accountFilesService.downloadForm(id);

				this.form	= {
					data: downloadTask.result,
					downloadProgress: downloadTask.progress,
					metadata: this.accountFilesService.watchMetadata(id)
				};
			}
			catch {
				this.router.navigate(['404']);
			}
		});
	}

	constructor (
		/** @ignore */
		private readonly activatedRoute: ActivatedRoute,

		/** @ignore */
		private readonly router: Router,

		/** @see AccountService */
		public readonly accountService: AccountService,

		/** @see AccountFilesService */
		public readonly accountFilesService: AccountFilesService,

		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {}
}